/**
 * Marker-based prompt isolation (FID-2026-1006-002 WP12).
 *
 * A baseline/candidate eval comparison is only meaningful when the two system
 * prompts differ by exactly the block under test. Forking the production
 * prompt builder to produce a variant guarantees drift instead: the fork keeps
 * compiling while the production prompt moves on. So the production prompt
 * carries named, stable marker comments around the block a comparison varies,
 * and a comparison strips that block out of the production text — the rest of
 * the prompt is byte-identical by construction.
 *
 * The marker contract is a whole line, exactly
 * `<!-- savant:block:<name> -->` … `<!-- /savant:block:<name> -->`, alone on
 * its line. A marker embedded in prose is rejected rather than guessed at: a
 * boundary that is inferred is a boundary that can silently move.
 *
 * Absence throws. `stripPromptBlock` with a name the prompt does not carry is a
 * hard error, because the failure mode it guards against is a comparison that
 * reports "no difference" while nothing was stripped at all.
 */

/** Prefix shared by every block marker. */
export const BLOCK_MARKER_PREFIX = '<!-- savant:block:'

/** The marker pair for one block name. */
export interface PromptBlockMarkers {
  /** `<!-- savant:block:<name> -->` */
  open: string
  /** `<!-- /savant:block:<name> -->` */
  close: string
}

/**
 * Block names must be safe to place inside an HTML comment: a name containing
 * `-`, `<`, `>` or whitespace could forge or truncate a marker.
 */
const VALID_BLOCK_NAME = /^[A-Za-z0-9._-]+$/

/** The open/close markers for `name`. */
export function blockMarkers(name: string): PromptBlockMarkers {
  if (!VALID_BLOCK_NAME.test(name)) {
    throw new Error(
      `prompt block name must be a non-empty token of [A-Za-z0-9._-]; received ${JSON.stringify(name)}`,
    )
  }
  return {
    open: `${BLOCK_MARKER_PREFIX}${name} -->`,
    close: `<!-- /savant:block:${name} -->`,
  }
}

type BlockLocation =
  | { kind: 'found'; openIndex: number; closeIndex: number }
  | { kind: 'no-open' }
  | { kind: 'no-close' }
  | { kind: 'inverted' }

/** Locate the marker lines for `name` (both markers must be alone on a line). */
function locateBlock(lines: readonly string[], name: string): BlockLocation {
  const { open, close } = blockMarkers(name)
  const openIndex = lines.findIndex((line) => line.trim() === open)
  if (openIndex === -1) return { kind: 'no-open' }
  const closeIndex = lines.findIndex((line) => line.trim() === close)
  if (closeIndex === -1) return { kind: 'no-close' }
  if (closeIndex < openIndex) return { kind: 'inverted' }
  return { kind: 'found', openIndex, closeIndex }
}

function absentError(name: string): Error {
  const { open } = blockMarkers(name)
  return new Error(
    `prompt block "${name}" is absent: no line is exactly "${open}" (a strip that silently no-ops would make a baseline/candidate comparison lie)`,
  )
}

/** Whether `prompt` carries a complete, well-ordered block named `name`. */
export function hasPromptBlock(prompt: string, name: string): boolean {
  return locateBlock(prompt.split('\n'), name).kind === 'found'
}

/**
 * Remove the block named `name` from `prompt`, along with its two marker lines.
 *
 * The seam is tidied so removal never leaves a doubled blank line: a block
 * between two paragraphs leaves exactly one blank line between them, and a
 * block at the head or the tail of the prompt takes the blank line that
 * separated it with it.
 *
 * Throws when the block is absent, when its close marker is missing, when the
 * close marker precedes the open marker, or when either marker is not alone on
 * its line.
 */
export function stripPromptBlock(prompt: string, name: string): string {
  const lines = prompt.split('\n')
  const location = locateBlock(lines, name)
  switch (location.kind) {
    case 'no-open':
      throw absentError(name)
    case 'no-close': {
      const { close } = blockMarkers(name)
      throw new Error(
        `prompt block "${name}" is unterminated: its open marker is present but no line is exactly "${close}"`,
      )
    }
    case 'inverted': {
      const { open, close } = blockMarkers(name)
      throw new Error(
        `prompt block "${name}" is malformed: the close marker "${close}" precedes the open marker "${open}"`,
      )
    }
    case 'found':
      break
  }

  const { openIndex, closeIndex } = location
  const removedAtStart = openIndex === 0
  const removedAtEnd = closeIndex === lines.length - 1
  const remaining = [
    ...lines.slice(0, openIndex),
    ...lines.slice(closeIndex + 1),
  ]

  if (removedAtStart) {
    let head = 0
    while (head < remaining.length && remaining[head] === '') head += 1
    return remaining.slice(head).join('\n')
  }

  if (removedAtEnd) {
    let tail = remaining.length
    while (tail > 0 && remaining[tail - 1] === '') tail -= 1
    return remaining.slice(0, tail).join('\n')
  }

  // Mid-prompt: collapse the two blank lines the removal can bring together
  // into the single blank line that separates two paragraphs.
  if (remaining[openIndex - 1] === '' && remaining[openIndex] === '') {
    remaining.splice(openIndex, 1)
  }
  return remaining.join('\n')
}

/**
 * Strip several named blocks in order. An empty list returns `prompt`
 * unchanged; a name that is not present throws (see `stripPromptBlock`).
 */
export function stripPromptBlocks(
  prompt: string,
  names: readonly string[],
): string {
  let current = prompt
  for (const name of names) {
    current = stripPromptBlock(current, name)
  }
  return current
}

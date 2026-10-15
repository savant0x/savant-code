/**
 * Strip XML-style <think> scaffolding from a model response.
 *
 * Handles:
 * - Paired tags: <think>...</think>
 * - Unclosed open tags: <think>... (truncated mid-thought)
 * - Orphan close tags: </think>
 *
 * Orphan closes show up with native-reasoning models (notably Kimi via
 * Alibaba/Infron): reasoning lands in `reasoning_content`, then content is
 * sometimes just `"</think> "`. Treating that as real text ends the agent
 * turn with no tool calls.
 */
export function stripThinkTags(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*$/g, '')
    .replace(/<\/think>/g, '')
    .trim()
}

/**
 * True when the response is non-empty but only think-tag scaffolding (no
 * other non-whitespace content). Such steps should continue rather than end
 * the turn.
 */
export function isThinkOnlyResponse(fullResponse: string): boolean {
  const trimmed = fullResponse.trim()
  if (trimmed.length === 0) {
    return false
  }
  return stripThinkTags(fullResponse).length === 0
}

const YAGNI_OPEN_RE = /<yagni_check\s*>/i
// NOTE: no `g` flag — the streaming stripper relies on match().index, which
// global-flag match() does not populate (it returns all matches as strings).
const YAGNI_CLOSE_RE = /<\/yagni_check\s*>/i

/**
 * Strip <yagni_check> scaffolding from a complete string (FID-2026-0822-004).
 *
 * Mirrors `stripThinkTags`' three-case shape:
 * - Paired tags: <yagni_check>...</yagni_check>
 * - Unclosed open tags: <yagni_check>... (truncated mid-block)
 * - Orphan close tags: </yagni_check>
 *
 * The Forge is prompted to emit a <yagni_check> JSON block at the top of its
 * response; without this stripper the harness relayed it raw into the
 * transcript (and a payload-embedded copy would pollute written files). Use
 * `createYagniCheckStreamStripper` for chunked/streaming text — a block can
 * span multiple chunks, and per-chunk stateless stripping leaks fragments.
 */
export function stripYagniCheckBlocks(text: string): string {
  return text
    .replace(/<yagni_check\s*>([\s\S]*?)<\/yagni_check\s*>/gi, '')
    .replace(/<yagni_check\s*>[\s\S]*$/gi, '')
    .replace(/<\/yagni_check\s*>/gi, '')
    .trim()
}

/**
 * Stateful streaming <yagni_check> stripper (FID-2026-0822-004).
 *
 * A yagni block emitted by the Forge can span multiple stream chunks. A
 * stateless per-chunk strip would leak block fragments (a chunk starting
 * mid-JSON has no opener to match). This stripper holds text from an unclosed
 * opener until its closer arrives; `flush()` at stream end drops a truncated
 * unclosed block (matching `stripThinkTags`' unclosed-open behavior).
 */
export function createYagniCheckStreamStripper(): {
  push(text: string): string
  flush(): string
} {
  let held = ''
  return {
    push(text: string): string {
      const combined = held + text
      held = ''
      let out = ''
      let rest = combined
      while (rest.length > 0) {
        const openIdx = rest.search(YAGNI_OPEN_RE)
        if (openIdx === -1) {
          // No opener in the remainder: strip orphan closes and emit.
          out += rest.replace(YAGNI_CLOSE_RE, '')
          return out
        }
        out += rest.slice(0, openIdx).replace(YAGNI_CLOSE_RE, '')
        const afterOpen = rest.slice(openIdx)
        const closeMatch = afterOpen.match(YAGNI_CLOSE_RE)
        if (!closeMatch || closeMatch.index === undefined) {
          // Unclosed opener — hold everything from the opener for the next
          // chunk; only the prefix before it is safe to emit.
          held = rest.slice(openIdx)
          return out
        }
        rest = afterOpen.slice(closeMatch.index + closeMatch[0].length)
      }
      return out
    },
    flush(): string {
      // Stream ended with an unclosed block: it is scaffolding — drop it.
      held = ''
      return ''
    },
  }
}

/**
 * Remove yagni_check blocks from a write-tool payload in place
 * (FID-2026-0822-004). Runs AFTER the pre-write gate parsed the block (the
 * gate's regex extraction is read-only) and BEFORE the handler executes, so a
 * payload-embedded block never pollutes the written file. Handles the three
 * write-tool shapes: write_file `content`, str_replace `newString` and
 * `replacements[].newString`, and apply_patch `operation.diff`.
 */
export function stripYagniCheckBlocksFromWritePayload(
  input: Record<string, unknown>,
): void {
  if (typeof input.content === 'string') {
    input.content = stripYagniCheckBlocks(input.content)
  }
  if (typeof input.newString === 'string') {
    input.newString = stripYagniCheckBlocks(input.newString)
  }
  const replacements = input.replacements
  if (Array.isArray(replacements)) {
    for (const replacement of replacements) {
      if (
        replacement &&
        typeof replacement === 'object' &&
        typeof (replacement as { newString?: unknown }).newString === 'string'
      ) {
        ;(replacement as { newString: string }).newString =
          stripYagniCheckBlocks(
            (replacement as { newString: string }).newString,
          )
      }
    }
  }
  const operation = input.operation
  if (
    operation &&
    typeof operation === 'object' &&
    typeof (operation as { diff?: unknown }).diff === 'string'
  ) {
    ;(operation as { diff: string }).diff = stripYagniCheckBlocks(
      (operation as { diff: string }).diff,
    )
  }
}

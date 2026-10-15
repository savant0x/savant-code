/**
 * Branch summarization (FID-2026-1006-002 WP6, adopted from T149 idea 6).
 *
 * When a run navigates away from a conversation branch, the branch must leave
 * behind a summary that a later turn can act on. The failure mode this module
 * exists to prevent is a summary that is *readable* but not *usable*: prose
 * that paraphrases a path, rounds an error message, or renames a symbol. So the
 * structure is FIXED (five sections, three Progress sub-lists, always present
 * even when empty) and the content is emitted verbatim — a consumer can parse
 * the skeleton, and every path, symbol and error string in it survives
 * unchanged.
 *
 * Savant's sessions are linear today, so this module is the format half of the
 * work package: the prompt/format contract and its tests, ready for the first
 * branching consumer. It owns no I/O and reads no clock.
 */

/** The five sections, in the order they must be rendered. */
export const BRANCH_SUMMARY_SECTIONS = [
  'Goal',
  'Constraints & Preferences',
  'Progress',
  'Key Decisions',
  'Next Steps',
] as const

export type BranchSummarySection = (typeof BRANCH_SUMMARY_SECTIONS)[number]

/** The three Progress sub-lists, in the order they must be rendered. */
export const BRANCH_SUMMARY_PROGRESS_SUBLISTS = [
  'Done',
  'In Progress',
  'Blocked',
] as const

export type BranchSummaryProgressSublist =
  (typeof BRANCH_SUMMARY_PROGRESS_SUBLISTS)[number]

export type BranchSummaryInput = {
  goal?: string
  constraints?: readonly string[]
  done?: readonly string[]
  inProgress?: readonly string[]
  blocked?: readonly string[]
  keyDecisions?: readonly string[]
  nextSteps?: readonly string[]
  customInstructions?: string
  replaceInstructions?: boolean
}

/** What an empty section renders — never nothing, so the skeleton is stable. */
export const BRANCH_SUMMARY_NONE_RECORDED = '_None recorded._'

/**
 * Drop items that carry no content. The test is on `trim()`, the EMITTED text
 * is the original string: trimming an item would rewrite the very thing the
 * summary exists to carry (a trailing space can be part of an error message).
 */
function usableItems(items: readonly string[] | undefined): string[] {
  if (!items) return []
  return items.filter(
    (item) => typeof item === 'string' && item.trim().length > 0,
  )
}

function bulletLines(items: readonly string[] | undefined): string[] {
  const usable = usableItems(items)
  if (usable.length === 0) return [BRANCH_SUMMARY_NONE_RECORDED]
  return usable.map((item) => `- ${item}`)
}

function textLine(value: string | undefined): string {
  return value !== undefined && value.trim().length > 0
    ? value
    : BRANCH_SUMMARY_NONE_RECORDED
}

function progressSection(
  label: BranchSummaryProgressSublist,
  items: readonly string[] | undefined,
): string[] {
  return [`### ${label}`, ...bulletLines(items)]
}

/**
 * Render the fixed branch-summary skeleton. Every section is present, in
 * `BRANCH_SUMMARY_SECTIONS` order, whether or not it has content.
 */
export function formatBranchSummary(input: BranchSummaryInput): string {
  const blocks: string[] = [
    ['## Goal', textLine(input.goal)].join('\n'),
    ['## Constraints & Preferences', ...bulletLines(input.constraints)].join(
      '\n',
    ),
    [
      '## Progress',
      ...progressSection('Done', input.done),
      ...progressSection('In Progress', input.inProgress),
      ...progressSection('Blocked', input.blocked),
    ].join('\n'),
    ['## Key Decisions', ...bulletLines(input.keyDecisions)].join('\n'),
    ['## Next Steps', ...bulletLines(input.nextSteps)].join('\n'),
  ]
  return blocks.join('\n\n')
}

export type BranchSummaryInstructionMode = 'append' | 'replace'

/**
 * The custom-instruction seam. `replaceInstructions: true` makes the caller's
 * instructions REPLACE the default summary guidance; otherwise they are
 * appended to it. Blank instructions are the same as absent ones — a mode with
 * nothing to say.
 */
export function resolveCustomInstructions(input: BranchSummaryInput): {
  mode: BranchSummaryInstructionMode
  instructions?: string
} {
  const instructions = input.customInstructions
  if (instructions === undefined || instructions.trim().length === 0) {
    return { mode: 'append' }
  }
  return input.replaceInstructions === true
    ? { mode: 'replace', instructions }
    : { mode: 'append', instructions }
}

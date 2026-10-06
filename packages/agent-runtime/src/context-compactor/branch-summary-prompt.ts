/**
 * Branch-summary prompt assembly (FID-2026-1006-002 WP6).
 *
 * The prompt is built from three parts, in this order:
 *
 * 1. the FIXED format guidance (the five sections and the three Progress
 *    sub-lists, from `branch-summarization.ts` — the contract a consumer
 *    parses, so it is never optional);
 * 2. the instruction block: the default summary guidance, replaced by the
 *    caller's instructions when `replaceInstructions` is set;
 * 3. the fidelity requirement — paths, symbol names and error text must be
 *    reproduced exactly, never paraphrased.
 *
 * The prompt is a pure function of its input: no clock, no I/O, no randomness.
 */

import {
  BRANCH_SUMMARY_PROGRESS_SUBLISTS,
  BRANCH_SUMMARY_SECTIONS,
  resolveCustomInstructions,
} from './branch-summarization'

import type { BranchSummaryInput } from './branch-summarization'

/** The default summary guidance, replaced wholesale by `replaceInstructions`. */
export const BRANCH_SUMMARY_DEFAULT_INSTRUCTIONS = [
  'Summarize the branch you are leaving so that a later turn can continue it',
  'without re-reading it: the goal, the constraints that were established, what',
  'is done, in progress and blocked, the decisions that were made and why, and',
  'the next concrete steps.',
].join('\n')

/**
 * The fidelity requirement. It is part of the format contract rather than part
 * of the guidance, so replacing the guidance does not drop it: a summary that
 * renames `canonicalMutationKey` or rounds an error string is unusable to
 * whoever picks the branch up next.
 */
export const BRANCH_SUMMARY_FIDELITY_INSTRUCTIONS = [
  'Reproduce every file path, symbol name, command and error message EXACTLY as',
  'it appears — never paraphrase, rename, translate or round them. If a step',
  'failed, quote the failure text rather than describing it.',
].join('\n')

const STRUCTURE_GUIDANCE = [
  'Write the summary in EXACTLY this structure, in this order:',
  ...BRANCH_SUMMARY_SECTIONS.map((section) =>
    section === 'Progress'
      ? `## Progress (with the sub-lists ${BRANCH_SUMMARY_PROGRESS_SUBLISTS.join(
          ', ',
        )})`
      : `## ${section}`,
  ),
].join('\n')

/** Build the branch-summary prompt for one branch (pure). */
export function buildBranchSummaryPrompt(input: BranchSummaryInput): string {
  const { mode, instructions } = resolveCustomInstructions(input)
  const blocks = [STRUCTURE_GUIDANCE]
  if (mode === 'append') blocks.push(BRANCH_SUMMARY_DEFAULT_INSTRUCTIONS)
  if (instructions !== undefined) blocks.push(instructions)
  blocks.push(BRANCH_SUMMARY_FIDELITY_INSTRUCTIONS)
  return blocks.join('\n\n')
}

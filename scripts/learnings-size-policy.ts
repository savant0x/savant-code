/**
 * The lessons ledger's size policy (FID-2026-1012-011).
 *
 * The ceiling used to live only in the tool that acts on it
 * (`scripts/learnings-retire.ts:29`), so a ledger past it could not announce
 * the breach: `learnings:check` passed at any length. Both ceilings are an
 * invariant of the artifact, not a parameter of the repair:
 *
 * - the **line** ceiling is the ledger's own bound, in the same unit retirement
 *   measures (newline-delimited segments, so a file with 1,174 newlines is 1,175
 *   segments — the number the retirement tool reports);
 * - the **character** ceiling protects the boot boundary
 *   (`FID-2026-1012-010`), which truncates on JavaScript characters rather than
 *   lines, and is measured on its own unit so neither ceiling can hide behind
 *   the other.
 *
 * The gate reports; the operator retires. Nothing here deletes content.
 */

import { DEFAULT_LINE_CAP, LEARNINGS_PATH } from './learnings-retire.js'

export const LEARNINGS_LINE_CEILING = DEFAULT_LINE_CAP
export const LEARNINGS_CHAR_CEILING = 100_000
export const LEARNINGS_RESTORE_COMMAND = 'bun run learnings:retire'

export interface LearningsSizeIssue {
  code: string
  message: string
}

/** The unit the retirement tool counts: newline-delimited segments. */
export function logicalLineCount(content: string): number {
  return content.split(/\r?\n/).length
}

/** JavaScript characters (UTF-16 code units) — the boot boundary's unit. */
export function characterCount(content: string): number {
  return content.length
}

function overBy(value: number, ceiling: number): number {
  return value - ceiling
}

export function learningsSizeIssues(content: string): LearningsSizeIssue[] {
  const issues: LearningsSizeIssue[] = []
  const lines = logicalLineCount(content)
  if (lines > LEARNINGS_LINE_CEILING) {
    issues.push({
      code: 'learning.size.line-ceiling',
      message:
        `${LEARNINGS_PATH} is ${lines.toLocaleString('en-US')} logical lines ` +
        `(newline-delimited segments) against a ceiling of ` +
        `${LEARNINGS_LINE_CEILING.toLocaleString('en-US')} — ` +
        `${overBy(lines, LEARNINGS_LINE_CEILING).toLocaleString('en-US')} over. ` +
        `Restore headroom with \`${LEARNINGS_RESTORE_COMMAND}\` ` +
        '(operator-run, move-only: nothing is deleted).',
    })
  }
  const chars = characterCount(content)
  if (chars > LEARNINGS_CHAR_CEILING) {
    issues.push({
      code: 'learning.size.char-ceiling',
      message:
        `${LEARNINGS_PATH} is ${chars.toLocaleString('en-US')} JavaScript ` +
        `characters (UTF-16 code units) against a ceiling of ` +
        `${LEARNINGS_CHAR_CEILING.toLocaleString('en-US')} — ` +
        `${overBy(chars, LEARNINGS_CHAR_CEILING).toLocaleString('en-US')} over. ` +
        `Restore headroom with \`${LEARNINGS_RESTORE_COMMAND}\` ` +
        '(operator-run, move-only: nothing is deleted).',
    })
  }
  return issues
}

/** Headroom is reported while the gate is green, so the limit is visible early. */
export function learningsSizeSummary(content: string): string {
  const lines = logicalLineCount(content)
  const chars = characterCount(content)
  return (
    `${lines.toLocaleString('en-US')}/${LEARNINGS_LINE_CEILING.toLocaleString('en-US')} logical lines, ` +
    `${chars.toLocaleString('en-US')}/${LEARNINGS_CHAR_CEILING.toLocaleString('en-US')} JavaScript characters ` +
    `(${(LEARNINGS_LINE_CEILING - lines).toLocaleString('en-US')} lines, ` +
    `${(LEARNINGS_CHAR_CEILING - chars).toLocaleString('en-US')} characters of headroom)`
  )
}

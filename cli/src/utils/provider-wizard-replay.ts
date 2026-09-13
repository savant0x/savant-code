/**
 * Wizard submission replay guard (FID-2026-0910-004 Loop 9, Law 12 secret
 * hygiene; FID-2026-0913-002 split from provider-wizard.ts).
 *
 * The live TUI smoke observed a duplicated submit arriving after the
 * terminal wizard step had already flipped the input mode back to 'default'.
 * The stale submit fell through to the regular-message path — recording the
 * pasted API key in the up-arrow recall history and dispatching it to the
 * agent as a chat message. A human double-pressing Enter at the key step
 * hits the same window.
 *
 * Guard contract: when a wizard submit is CONSUMED, the route handler marks
 * its exact text here (only non-empty, non-command text is tombstoned);
 * the router checks `isWizardSubmissionReplayed` on the default path and
 * silently drops an identical replay within the TTL window. This is a
 * fail-closed one-shot tombstone: the first legitimate re-submission of the
 * same text after the window (or after `clearWizardReplayGuard`) is never
 * affected, and command-shaped payloads are never tombstoned.
 */

/** How long a consumed submission stays tombstoned (ms). */
const REPLAY_GUARD_TTL_MS = 1_000

/** One-shot tombstones keyed by the exact consumed submission text. */
const consumedSubmissions = new Map<string, number>()

/** True when the payload is wizard-step material (never a slash command). */
function isWizardStepPayload(value: string): boolean {
  return !value.startsWith('/')
}

/** Mark a consumed wizard submission so its duplicate is dropped. */
export function markWizardSubmissionConsumed(
  submission: string,
  nowMs: number = Date.now(),
): void {
  const value = submission.trim()
  if (!value || !isWizardStepPayload(value)) return
  consumedSubmissions.set(value, nowMs)
}

/** True when `submission` duplicates a just-consumed wizard submission. */
export function isWizardSubmissionReplayed(
  submission: string,
  nowMs: number = Date.now(),
): boolean {
  const value = submission.trim()
  const markedAt = consumedSubmissions.get(value)
  if (markedAt === undefined) return false
  if (nowMs - markedAt > REPLAY_GUARD_TTL_MS) {
    consumedSubmissions.delete(value)
    return false
  }
  // One-shot: the drop consumes the tombstone. A second identical submit
  // beyond the first is treated as a genuine new submission.
  consumedSubmissions.delete(value)
  return true
}

/** Clear all tombstones (new wizard session, Escape, tests). */
export function clearWizardReplayGuard(): void {
  consumedSubmissions.clear()
}

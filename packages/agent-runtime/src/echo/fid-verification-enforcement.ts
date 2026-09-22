/**
 * @module echo/fid-verification-enforcement
 *
 * FID-2026-0919-021 (operator ruling on T69, 2026-09-19).
 *
 * `validateFidVerification` enforces the declared gates + receipt freshness
 * contract only for `fixed`/`verified`. Every other status — `closed`
 * included — was skipped SILENTLY. That silence is how the repository came
 * to hold 284 of 315 archived `closed` records whose receipt fingerprint no
 * longer matches their content: the closure ceremony edits the document
 * (status flip + `- **Archived:**` line) after the last stamp, by design,
 * and nothing re-stamps or re-checks a closed record afterwards. Causally
 * proven on FID-2026-0918-007 — its stored fingerprint `sha256:3817c5e2…`
 * matched the content at `6e816902` (status `verified`) and stopped matching
 * at `3a0fe8dd`, the closure batch commit that flipped the status without
 * re-stamping.
 *
 * The operator ruled the closed-record behavior BY-DESIGN rather than a
 * repair target, with one requirement: state it. A `closed` record carries
 * NO live fingerprint guarantee — its receipt is the record of the
 * verification that earned the status, not a claim about the current bytes.
 *
 * This module is the single source of that decision. `validateFidVerification`
 * asks it whether to enforce (so the report and the skip can never disagree)
 * and the `fid:verify --check` scan prints it, turning a silent omission
 * into an explicit, non-fatal line of output.
 */

/** The `**Status:**` declaration line. */
const STATUS_LINE = /^\*\*Status:\*\*\s*(.+)$/m

/** The statuses for which gates + receipt freshness are enforced. */
export const ENFORCED_VERIFICATION_STATUSES: ReadonlySet<string> = new Set([
  'fixed',
  'verified',
])

/** Whether the verification contract applies to a document, and why. */
export type VerificationEnforcement = {
  enforced: boolean
  reason: string
}

/** Read the declared FID status, or undefined when the line is absent. */
export function parseFidStatus(content: string): string | undefined {
  return content.match(STATUS_LINE)?.[1]?.trim()
}

/**
 * Report whether the verification contract is enforced for this document,
 * with a reason that is safe to print verbatim. Pure and deterministic.
 */
export function describeVerificationEnforcement(
  content: string,
): VerificationEnforcement {
  const status = parseFidStatus(content)
  if (!status) {
    return {
      enforced: false,
      reason:
        'no **Status:** line — the verification contract is not enforced ' +
        'for this document (FID-2026-0919-021)',
    }
  }
  if (!ENFORCED_VERIFICATION_STATUSES.has(status)) {
    return {
      enforced: false,
      reason:
        `status "${status}" is outside {fixed, verified} — no live ` +
        'fingerprint guarantee: this receipt records the verification that ' +
        'earned the status, and the closure ceremony edits the document ' +
        'after the last stamp by design, so a fingerprint drift here is ' +
        'expected, not an error (FID-2026-0919-021)',
    }
  }
  return {
    enforced: true,
    reason:
      `status "${status}" — declared gates + a fresh receipt are enforced ` +
      '(FID-2026-0919-021)',
  }
}

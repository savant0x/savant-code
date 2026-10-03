/**
 * @module echo/pre-write-gates-law3
 *
 * FID-2026-0918-005: the Law 3 pre-write gate, extracted from
 * pre-write-gates.ts under the 300-line ceiling, with the blocking scope
 * narrowed from "any unverified-dirty code file blocks every write" to a
 * two-part rule:
 *
 *   1. Target-dirty hard block (kept): re-editing a file that is itself
 *      dirty-and-unverified still blocks — "verify before re-editing."
 *   2. Other-dirty BLOCK (restored 2026-10-02, FID-2026-1001-003 step 4):
 *      other code files' pending verification blocks again. The 2026-09-18
 *      demotion to advisory (FID-2026-0918-005) was ruled attribution
 *      laundering by the operator (Ruling 1): Laws 1-4 are not advice. The
 *      deadlock the demotion escaped is prevented three ways instead of by
 *      the demotion: the verification-escape clause below, the failure-
 *      attribution and self_correct exemptions (the repair path), and the
 *      N=3 escalation ladder (enforcement/escalation.ts) whose terminal
 *      response is turn termination rather than an unverified exit.
 *
 * FID-2026-0927-003 F2: the target-dirty block is where a RED verification
 * run deadlocked. Credit is withheld on failure, so the file the run is
 * complaining about became unwritable — and editing that file is the only
 * legal repair. The gate could not distinguish "the test is wrong, fix it"
 * from "the code is wrong, do not edit the test to hide it", so the legitimate
 * case was unrecoverable and the only exit was to `rm` the file, defeating the
 * gate entirely.
 *
 * Two narrow exemptions, both recorded as advisories rather than applied
 * silently:
 *
 *   (a) FAILURE-ATTRIBUTED — the target is one of the files the failed run
 *       named (`state.failureAttributedFiles`). Editing it is the repair.
 *   (b) SELF_CORRECT — the caller is in the protocol's own repair phase, which
 *       covers the case where attribution could not be determined.
 *
 * Neither is a general loosening. A dirty-unverified file that the failed run
 * did NOT name, outside `self_correct`, is still blocked — that is the
 * anti-masking property, and it is what keeps this a gate rather than a
 * suggestion. Turn-end Law 15 (enforcement/turn-end.ts) still blocks ending a
 * turn with unverified files, so an exemption can never become an exit.
 *
 * History: FID-2026-0819-001 (cumulative credit), FID-2026-0820-012
 * (unverified-dirty predicate over hasVerifiedSinceLastDirty),
 * FID-2026-0917-002 (docs/code split via classifyFileKind),
 * FID-2026-0918-005 (target-scope narrowing), FID-2026-0927-003 F2
 * (failure attribution + self_correct fallback — the liveness half of the
 * same root cause as F1).
 */

import { canonicalizePath } from './path-canonicalization'
import { isExemptWritePath } from './pre-write-gates-paths'
import { classifyFileKind } from '../util/echo-compliance-core'

import type { AdvisoryWarning, EnforcementState } from './types'

export type Law3GateResult =
  { blocked: true; reason: string } | { blocked: false }

/**
 * Whether a failure-attributed path is the SAME file as the write target.
 *
 * EXACT canonical equality, deliberately. Both sides are canonicalized
 * against the same `process.cwd()` — attribution at record time
 * (tool-pipeline.ts) and the target here — so a repo-relative
 * `src/tick.test.ts` and an absolute write of the same file both reduce to one
 * string, and exact comparison is sufficient.
 *
 * An earlier draft matched on a path-segment-boundary SUFFIX; audit rejected
 * it. `tsc` emits a BARE basename when run from inside a directory, and
 * `tick.test.ts` as a suffix matches ANY same-named file anywhere in the repo,
 * unlocking it. So neither `other/tick.test.ts` nor a bare `tick.test.ts` may
 * satisfy attribution for `src/tick.test.ts`. Exact matching makes both
 * impossible and fails CLOSED — when identity cannot be proven, the write is
 * blocked, which is the correct direction for a permission widener.
 */
function attributionMatches(
  attributed: string,
  targetCanonical: string,
): boolean {
  return attributed.replace(/\\/g, '/') === targetCanonical.replace(/\\/g, '/')
}

/**
 * Run the Law 3 gate. Advisories are pushed into the caller's `warnings`
 * array (the same array semantics the parent uses for every gate), so the
 * tool executor emits them as compliance_warning receipts unchanged.
 */
export function runLaw3Gate(params: {
  targetPath: string | undefined
  state: EnforcementState
  warnings: AdvisoryWarning[]
  /**
   * FID-2026-0927-003 F2: the caller's current Perfection Loop phase.
   * Typed `string` rather than the FSM union because the gate receives it
   * through the enforcement facade, which is public API; a typo fails closed
   * (the exemption does not fire) and the advisory path still records why.
   */
  fsmPhase?: string
  /**
   * FID-2026-1001-003 step 4: TRUE when the pending call IS the verification
   * the Law 3 block would demand (`detectsVerificationCommand` over
   * `terminalCommandCandidates` — the same predicate the credit path uses,
   * Law 13). The block must never fire on its own cure.
   */
  verificationEscape?: boolean
}): Law3GateResult {
  const { targetPath, state, warnings, fsmPhase } = params

  // ── Deadlock escape clause (FID-2026-1001-003 step 4, mandatory) ────
  // The pre-write block never fires on a command that IS the verification
  // the block is asking for: the command passes through to earn credit in
  // afterToolCallImpl via the same predicate (Law 13 — one definition of
  // "verification", so the gate and the credit path cannot disagree).
  if (params.verificationEscape === true) return { blocked: false }

  // Same unverified-dirty predicate as evaluateTurnEnd's Law 15 check —
  // one source of truth (FID-2026-0820-012). Docs are excluded by the
  // classifyFileKind split (FID-2026-0917-002): they verify via
  // markdownlint, never via this code gate.
  const unverifiedDirty = [...state.dirtyFiles].filter(
    (f) => !state.verifiedFiles.has(f) && classifyFileKind(f) === 'code',
  )
  if (unverifiedDirty.length === 0) return { blocked: false }

  // Exempt-path targets are never blocked by pending code verification —
  // governance bookkeeping must not be wedged by unverified code
  // (FID-2026-0718-008, FID-2026-0820-012).
  if (targetPath && isExemptWritePath(targetPath)) return { blocked: false }

  const targetCanonical = targetPath ? canonicalizePath(targetPath) : undefined
  const targetDirty =
    targetCanonical !== undefined &&
    unverifiedDirty.some((f) => canonicalizePath(f) === targetCanonical)

  if (targetDirty) {
    // ── FID-2026-0927-003 F2 (a): failure-attributed exemption ─────────
    // The failed run named THIS file, so this edit is its repair.
    if (
      targetCanonical !== undefined &&
      [...state.failureAttributedFiles].some((attributed) =>
        attributionMatches(attributed, targetCanonical),
      )
    ) {
      warnings.push({
        law: 3,
        severity: 'warning',
        message:
          `Law 3: "${targetPath}" is dirty and unverified, but the last ` +
          'verification run FAILED and named this file, so editing it is the ' +
          'repair rather than a bypass. Fix the reported failure; a green run ' +
          'restores the block.',
        file: targetPath,
      })
      return { blocked: false }
    }

    // ── FID-2026-0927-003 F2 (b): self_correct fallback ────────────────
    // The protocol's own repair phase, for when attribution could not be
    // determined (an unparseable failure, or a failure naming no file).
    if (fsmPhase === 'self_correct') {
      warnings.push({
        law: 3,
        severity: 'warning',
        message:
          `Law 3: "${targetPath}" is dirty and unverified. Writable because ` +
          'the session is in the self_correct repair phase; this is recorded, ' +
          'not silent. Verification is still required before the turn ends.',
        file: targetPath,
      })
      return { blocked: false }
    }

    // Anti-masking: NOT attributed, NOT self_correct → still blocked.
    return {
      blocked: true,
      reason:
        `Law 3: Verify before re-editing — "${targetPath}" is dirty and ` +
        `unverified. Run typecheck/lint before re-editing this file.`,
    }
  }

  // ── Other-dirty BLOCK (restored, FID-2026-1001-003 step 4) ─────────
  // Ruling 1: Laws 1-4 are not advice — the FID-2026-0918-005 demotion of
  // this branch to advisory was attribution laundering. The block names the
  // same set the old advisory did; the escalation ladder (escalation.ts)
  // keys its N=3 response on exactly this block.
  return {
    blocked: true,
    reason:
      `Law 3: Verify before proceeding — ${unverifiedDirty.length} unverified ` +
      `file(s) pending: [${unverifiedDirty.join(', ')}]. Run typecheck/lint ` +
      `(a green verification run re-arms these files) before writing ` +
      `other code.`,
  }
}

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
 *   2. Other-dirty advisory (new): OTHER files' pending verification is
 *      advisory. The batch-writes-then-verify pattern (explicitly allowed
 *      by the tracker layer — echo-compliance.ts evaluateAtStepBoundary
 *      fires only on `endingTurn`) can no longer deadlock: an interlocked
 *      multi-file batch whose intermediate state breaks the typecheck can
 *      always write the repair file.
 *
 * Law 3's invariant is preserved where it belongs: evaluateTurnEndImpl
 * (enforcement/turn-end.ts) still blocks ending a turn with unverified
 * files, and the tracker still steers at the step boundary.
 *
 * History: FID-2026-0819-001 (cumulative credit), FID-2026-0820-012
 * (unverified-dirty predicate over hasVerifiedSinceLastDirty),
 * FID-2026-0917-002 (docs/code split via classifyFileKind),
 * FID-2026-0918-005 (target-scope narrowing — the third deadlock-family
 * fix; the code-code interlock variant).
 */

import { canonicalizePath } from './path-canonicalization'
import { isExemptWritePath } from './pre-write-gates-paths'
import { classifyFileKind } from '../util/echo-compliance-core'

import type { AdvisoryWarning, EnforcementState } from './types'

export type Law3GateResult =
  { blocked: true; reason: string } | { blocked: false }

/**
 * Run the Law 3 gate. Advisories are pushed into the caller's `warnings`
 * array (the same array semantics the parent uses for every gate), so the
 * tool executor emits them as compliance_warning receipts unchanged.
 */
export function runLaw3Gate(params: {
  targetPath: string | undefined
  state: EnforcementState
  warnings: AdvisoryWarning[]
}): Law3GateResult {
  const { targetPath, state, warnings } = params

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
    return {
      blocked: true,
      reason:
        `Law 3: Verify before re-editing — "${targetPath}" is dirty and ` +
        `unverified. Run typecheck/lint before re-editing this file.`,
    }
  }

  // FID-2026-0918-005: other-file dirtiness is advisory. The warning names
  // the same set the old hard block named — visibility without the
  // deadlock. Turn-end Law 15 still blocks an unverified exit.
  warnings.push({
    law: 3,
    severity: 'warning',
    message:
      `Law 3: ${unverifiedDirty.length} unverified file(s) pending: ` +
      `[${unverifiedDirty.join(', ')}]. Run typecheck/lint before ` +
      `finishing the turn.`,
    file: targetPath,
  })
  return { blocked: false }
}

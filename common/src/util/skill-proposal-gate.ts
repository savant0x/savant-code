/**
 * FID-2026-0912-004 — the gate-before-present contract.
 *
 * WikiSkill's gating rule adapted with the SkillOpt issue #67 correction:
 * acceptance requires strict mean improvement AND zero per-task regressions
 * (a mean-positive edit that flips any baseline pass to a fail is an
 * evaluator-gaming shape and must be rejected). This module is the single
 * evaluation point; the evals prove engine and the CLI label renderer both
 * consume it, so the criterion and the labels can never drift apart.
 *
 * Dependency-light by design: the input is the same normalized summary the
 * proof-gate renderer already reads (.savant/skill-proofs/<name>.json via
 * readProofGate), extended with the paired-trial outcome rows needed for the
 * per-task check. No cross-workspace import from evals.
 */

export type ProposalTrialOutcome = {
  index: number
  passed: boolean
}

export type ProposalReceipt = {
  /** Paired-trial outcomes, baseline and active, index-aligned. */
  baseline: ProposalTrialOutcome[]
  active: ProposalTrialOutcome[]
  /** Existing artifact gate fields (mean-lift + reliability preconditions). */
  activationVerified: boolean
  passPowK: number
  immutableThreshold: number
  minTrials: number
  activeTrialCount: number
}

export type ProposalGateResult = {
  accepted: boolean
  meanLift: number
  perTaskRegressions: number
  reasons: string[]
}

/**
 * The WikiSkill gate with the no-regression correction:
 *   accepted = strict mean lift AND zero per-task regressions
 *              AND activation verified AND reliability met AND N >= minTrials.
 * Per-task regression: a baseline trial that passed while the index-aligned
 * active trial failed.
 */
export function evaluateProposalGate(
  receipt: ProposalReceipt,
): ProposalGateResult {
  const baselinePassRate =
    receipt.baseline.length === 0
      ? 0
      : receipt.baseline.filter((t) => t.passed).length /
        receipt.baseline.length
  const activePassRate =
    receipt.active.length === 0
      ? 0
      : receipt.active.filter((t) => t.passed).length / receipt.active.length
  const meanLift = activePassRate - baselinePassRate

  let regressions = 0
  for (let i = 0; i < receipt.baseline.length; i++) {
    const baselineTrial = receipt.baseline[i]
    const activeTrial = receipt.active[i]
    if (baselineTrial?.passed === true && activeTrial?.passed === false) {
      regressions++
    }
  }

  const reasons: string[] = []
  if (!(meanLift > 0)) reasons.push('no strict mean improvement')
  if (regressions > 0) {
    reasons.push(`per-task regression detected on ${regressions} trial(s)`)
  }
  if (receipt.activationVerified !== true) {
    reasons.push('activation not verified')
  }
  if (!(receipt.passPowK > receipt.immutableThreshold)) {
    reasons.push('pass^k reliability below threshold')
  }
  if (receipt.activeTrialCount < receipt.minTrials) {
    reasons.push(
      `insufficient active trials (${String(receipt.activeTrialCount)} < ${String(receipt.minTrials)})`,
    )
  }

  return {
    accepted: reasons.length === 0,
    meanLift,
    perTaskRegressions: regressions,
    reasons,
  }
}

/**
 * The honest label for a draft's epistemic state. Null receipt (or a
 * rejected/errored one) renders UNPROVEN — trusting blind is made visible.
 */
export function formatProposalLabel(
  gate: { accepted: boolean } | null,
): string {
  return gate !== null && gate.accepted
    ? '[✓ PROVEN]'
    : '[⚠ UNPROVEN — TRUSTING BLIND]'
}

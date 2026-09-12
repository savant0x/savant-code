/**
 * FID-2026-0912-004 — artifact → gate-receipt bridge.
 *
 * Maps the evals prove engine's zod-validated SkillProofArtifact onto the
 * shared ProposalReceipt (common/skill-proposal-gate) so the per-task
 * no-regression criterion runs against the SAME object the CLI label
 * renderer reads. Single evaluation point; no criterion duplication.
 */

import type { SkillProofArtifact } from '../stats/skill-efficacy'
import type { ProposalReceipt } from '@savant-code/common/util/skill-proposal-gate'


export function gateReceiptFromArtifact(
  artifact: SkillProofArtifact,
): ProposalReceipt {
  return {
    baseline: artifact.trials.baseline.map((t) => ({
      index: t.index,
      passed: t.passed,
    })),
    active: artifact.trials.active.map((t) => ({
      index: t.index,
      passed: t.passed,
    })),
    activationVerified: artifact.activation_verified,
    passPowK: artifact.metrics.pass_pow_k,
    immutableThreshold: artifact.gate.immutable_threshold,
    minTrials: artifact.gate.min_trials,
    activeTrialCount: artifact.trials.active.length,
  }
}

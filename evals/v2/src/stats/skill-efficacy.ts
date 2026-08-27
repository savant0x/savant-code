import { z } from 'zod'

/**
 * FID-2026-0824-016: pure skill-efficacy statistics core.
 *
 * Deterministic and unit-testable by design — no I/O, no clock, no runner
 * coupling. `prove/skill-prove.ts` orchestrates trials and calls into these
 * functions; the CLI surfaces the resulting artifact.
 *
 * Dual-metric model (Anthropic engineering pattern):
 *   - pass@k  = 1 − (1 − p̂)^k   capability: P(at least one of k succeeds)
 *   - pass^k  = p̂^k              reliability: P(all k succeed)
 * skill_lift = E[active] − E[baseline] over per-trial pass booleans.
 */

export const trialOutcomeSchema = z.object({
  index: z.number().int().min(0),
  passed: z.boolean(),
  /** Active-arm only: did the trace cite the skill (activation check)? */
  activated: z.boolean().optional(),
  /** sha256 of the serialized trace events for this trial. */
  trace_sha256: z.string().length(64),
})
export type TrialOutcome = z.infer<typeof trialOutcomeSchema>

/**
 * FID-2026-0824-018 additive block. OPTIONAL so v1.0 artifacts written
 * before the guard existed keep parsing unchanged (back-compat contract).
 */
export const erosionBlockSchema = z.object({
  measured: z.boolean(),
  verbosity_delta_pct: z.number().optional(),
  structural_erosion_pct: z.number().optional(),
  blocked: z.boolean().optional(),
  reasons: z.array(z.string()).optional(),
})
export type ErosionBlock = z.infer<typeof erosionBlockSchema>

export const proofArtifactSchema = z.object({
  schema_version: z.literal('1.0'),
  skill_name: z.string().min(1),
  task_id: z.string().min(1),
  generated_at: z.string(),
  k: z.number().int().positive(),
  trials: z.object({
    baseline: z.array(trialOutcomeSchema),
    active: z.array(trialOutcomeSchema),
  }),
  metrics: z.object({
    baseline_pass_rate: z.number().min(0).max(1),
    active_pass_rate: z.number().min(0).max(1),
    skill_lift: z.number().min(-1).max(1),
    pass_at_k: z.number().min(0).max(1),
    pass_pow_k: z.number().min(0).max(1),
  }),
  activation_verified: z.boolean(),
  gate: z.object({
    immutable_threshold: z.number().min(0).max(1),
    min_trials: z.number().int().positive(),
    reliability_met: z.boolean(),
    eligible_for_immutable: z.boolean(),
  }),
  ztap: z.object({
    mode: z.enum(['off', 'record', 'enforce']),
    bound: z.boolean(),
    /** Optional fingerprint of the ZTAP receipt binding this artifact. */
    receipt_fingerprint: z.string().optional(),
  }),
  erosion: erosionBlockSchema.optional(),
})
export type SkillProofArtifact = z.infer<typeof proofArtifactSchema>
export type ZtapMode = 'off' | 'record' | 'enforce'

/** Mean pass rate over a trial arm (0 for an empty arm). */
export function meanPassRate(trials: readonly TrialOutcome[]): number {
  if (trials.length === 0) {
    return 0
  }
  const passed = trials.reduce((sum, t) => sum + (t.passed ? 1 : 0), 0)
  return passed / trials.length
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/** Capability metric: P(≥1 success in k trials) given observed rate p̂. */
export function passAtK(pHat: number, k: number): number {
  if (k <= 0) return 0
  return 1 - Math.pow(1 - clamp01(pHat), k)
}

/** Reliability metric: P(all k trials succeed) given observed rate p̂. */
export function passPowK(pHat: number, k: number): number {
  if (k <= 0) return 0
  return Math.pow(clamp01(pHat), k)
}

export interface EvaluateEfficacyParams {
  skillName: string
  taskId: string
  baseline: TrialOutcome[]
  active: TrialOutcome[]
  k: number
  ztapMode: ZtapMode
  /** Default 0.95 — blueprint immutable gate. */
  immutableThreshold?: number
  /** Default 3 — local default; CI reserves N=20 (blueprint risk register). */
  minTrials?: number
}

/**
 * Full paired-arm evaluation: rates, lift, dual metrics, activation verdict,
 * and the immutable-promotion gate. Pure — identical inputs give identical
 * artifacts except `generated_at`.
 */
export function evaluateSkillEfficacy(
  params: EvaluateEfficacyParams,
): SkillProofArtifact {
  const immutableThreshold = params.immutableThreshold ?? 0.95
  const minTrials = params.minTrials ?? 3

  const baselinePassRate = meanPassRate(params.baseline)
  const activePassRate = meanPassRate(params.active)
  const skillLift = activePassRate - baselinePassRate
  const passAtKValue = passAtK(activePassRate, params.k)
  const passPowKValue = passPowK(activePassRate, params.k)

  // Activation check (Coder Eval adaptation): EVERY active-arm trial must
  // have cited the skill — an unactivated success is not attributable.
  const activationVerified =
    params.active.length > 0 && params.active.every((t) => t.activated === true)

  const reliabilityMet = passPowKValue > immutableThreshold
  const eligibleForImmutable =
    activationVerified && reliabilityMet && params.active.length >= minTrials

  return {
    schema_version: '1.0',
    skill_name: params.skillName,
    task_id: params.taskId,
    generated_at: new Date().toISOString(),
    k: params.k,
    trials: { baseline: params.baseline, active: params.active },
    metrics: {
      baseline_pass_rate: baselinePassRate,
      active_pass_rate: activePassRate,
      skill_lift: skillLift,
      pass_at_k: passAtKValue,
      pass_pow_k: passPowKValue,
    },
    activation_verified: activationVerified,
    gate: {
      immutable_threshold: immutableThreshold,
      min_trials: minTrials,
      reliability_met: reliabilityMet,
      eligible_for_immutable: eligibleForImmutable,
    },
    ztap: { mode: params.ztapMode, bound: params.ztapMode !== 'off' },
  }
}

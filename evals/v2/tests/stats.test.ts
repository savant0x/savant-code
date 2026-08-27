import { describe, expect, it } from 'bun:test'

import {
  evaluateSkillEfficacy,
  meanPassRate,
  passAtK,
  passPowK,
  proofArtifactSchema,
} from '../src/stats/skill-efficacy'

import type { TrialOutcome } from '../src/stats/skill-efficacy'

/** Deterministic 64-char pseudo-hash keyed by trial shape. */
function trial(
  index: number,
  passed: boolean,
  activated?: boolean,
): TrialOutcome {
  const suffix =
    activated === undefined ? String(passed) : `${passed}-${activated}`
  return {
    index,
    passed,
    ...(activated !== undefined ? { activated } : {}),
    trace_sha256: `hash-${index}-${suffix}`.padEnd(64, '0').slice(0, 64),
  }
}

describe('pass@k / pass^k vectors (FID-2026-0824-016)', () => {
  it('computes the capability metric', () => {
    expect(passAtK(0.75, 2)).toBeCloseTo(0.9375, 12)
    expect(passAtK(0, 3)).toBe(0)
    expect(passAtK(1, 5)).toBe(1)
    expect(passAtK(1.5, 2)).toBe(1) // clamped
    expect(passAtK(0.5, 0)).toBe(0)
  })

  it('computes the reliability metric', () => {
    expect(passPowK(0.99, 20)).toBeCloseTo(0.8179, 4)
    expect(passPowK(0.98, 3)).toBeCloseTo(0.941192, 8)
    expect(passPowK(1, 5)).toBe(1)
    expect(passPowK(-0.5, 2)).toBe(0) // clamped
  })

  it('means an empty arm to zero', () => {
    expect(meanPassRate([])).toBe(0)
  })
})

describe('evaluateSkillEfficacy (FID-2026-0824-016)', () => {
  const baseline = [trial(0, false), trial(1, true), trial(2, false)]
  const activeAllGood = [
    trial(0, true, true),
    trial(1, true, true),
    trial(2, true, true),
  ]

  it('computes paired lift and dual metrics', () => {
    const artifact = evaluateSkillEfficacy({
      skillName: 'tdd-guard',
      taskId: 'task-001',
      baseline,
      active: activeAllGood,
      k: 3,
      ztapMode: 'record',
    })
    expect(artifact.metrics.baseline_pass_rate).toBeCloseTo(1 / 3, 12)
    expect(artifact.metrics.active_pass_rate).toBe(1)
    expect(artifact.metrics.skill_lift).toBeCloseTo(2 / 3, 12)
    expect(artifact.metrics.pass_at_k).toBe(1)
    expect(artifact.metrics.pass_pow_k).toBe(1)
    expect(artifact.activation_verified).toBe(true)
    expect(artifact.gate.eligible_for_immutable).toBe(true)
    expect(artifact.ztap.bound).toBe(true)
  })

  it('fails activation when any active trial does not cite the skill', () => {
    const active = [
      trial(0, true, true),
      trial(1, true, false), // success NOT attributable to the skill
      trial(2, true, true),
    ]
    const artifact = evaluateSkillEfficacy({
      skillName: 'tdd-guard',
      taskId: 'task-001',
      baseline,
      active,
      k: 3,
      ztapMode: 'record',
    })
    expect(artifact.activation_verified).toBe(false)
    expect(artifact.gate.eligible_for_immutable).toBe(false)
  })

  it('requires STRICTLY above the immutable threshold', () => {
    // p̂ = 1 with k = 1 and threshold = 1 → pass^k == threshold → NOT met.
    const artifact = evaluateSkillEfficacy({
      skillName: 'edge',
      taskId: 'task-edge',
      baseline: [trial(0, false)],
      active: [trial(0, true, true)],
      k: 1,
      ztapMode: 'off',
      immutableThreshold: 1,
    })
    expect(artifact.gate.reliability_met).toBe(false)
    expect(artifact.ztap.bound).toBe(false)
  })

  it('requires at least minTrials active trials', () => {
    const artifact = evaluateSkillEfficacy({
      skillName: 'short',
      taskId: 'task-short',
      baseline: [],
      active: [trial(0, true, true)],
      k: 1,
      ztapMode: 'enforce',
      minTrials: 3,
    })
    expect(artifact.gate.reliability_met).toBe(true)
    expect(artifact.gate.eligible_for_immutable).toBe(false)
  })

  it('round-trips through the proof-artifact schema', () => {
    const artifact = evaluateSkillEfficacy({
      skillName: 'round-trip',
      taskId: 'task-rt',
      baseline: [trial(0, false)],
      active: [trial(0, true, true), trial(1, true, true)],
      k: 2,
      ztapMode: 'record',
    })
    const parsed = proofArtifactSchema.parse(artifact)
    expect(parsed.skill_name).toBe('round-trip')
    expect(parsed.schema_version).toBe('1.0')
  })
})

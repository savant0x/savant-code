// FID-2026-1005-003 Step 5 — proof labels bind to skill content + a
// multi-task fixture manifest. Legacy/single-task artifacts stay UNPROVEN.
import { describe, expect, it } from 'bun:test'

import {
  proofArtifactSchema,
  proofContentBlockSchema,
  proofLabelForArtifact,
} from '../src/stats/skill-efficacy'

import type { SkillProofArtifact } from '../src/stats/skill-efficacy'

const sha = (seed: string) => seed.padEnd(64, '0').slice(0, 64)

function baseArtifact(overrides: Partial<SkillProofArtifact> = {}): SkillProofArtifact {
  return proofArtifactSchema.parse({
    schema_version: '1.0',
    skill_name: 'no-environment-dependent-guards',
    task_id: 'task-a',
    generated_at: '2026-10-05T00:00:00.000Z',
    k: 3,
    trials: {
      baseline: [{ index: 0, passed: false, trace_sha256: sha('b0') }],
      active: [
        { index: 0, passed: true, activated: true, trace_sha256: sha('a0') },
      ],
    },
    metrics: {
      baseline_pass_rate: 0,
      active_pass_rate: 1,
      skill_lift: 1,
      pass_at_k: 1,
      pass_pow_k: 1,
    },
    activation_verified: true,
    gate: {
      immutable_threshold: 0.95,
      min_trials: 3,
      reliability_met: true,
      eligible_for_immutable: true,
    },
    ztap: { mode: 'off', bound: false },
    ...overrides,
  })
}

function manifest(overrides: Partial<{ regressed: boolean }> = {}) {
  return [
    {
      task_id: 'task-a',
      role: 'representative' as const,
      baseline_pass_rate: 0,
      active_pass_rate: 1,
      regressed: false,
    },
    {
      task_id: 'task-near-miss',
      role: 'near_miss' as const,
      baseline_pass_rate: 1,
      active_pass_rate: 1,
      regressed: overrides.regressed ?? false,
    },
    {
      task_id: 'task-unaffected',
      role: 'unaffected' as const,
      baseline_pass_rate: 1,
      active_pass_rate: 1,
      regressed: false,
    },
  ]
}

describe('proofLabelForArtifact (FID-2026-1005-003 Step 5)', () => {
  it('labels PROVEN ON N TASKS only for a current, manifest-backed, passing artifact', () => {
    const artifact = baseArtifact({
      skill_content_sha256: sha('skill-bytes'),
      tasks: manifest(),
    } as Partial<SkillProofArtifact>)
    const label = proofLabelForArtifact(artifact, sha('skill-bytes'))
    expect(label.label).toBe('proven_on_n_tasks')
    expect(label.taskCount).toBe(3)
    expect(label.reasons).toEqual([])
  })

  it('rejects a legacy single-task artifact (no content block)', () => {
    const label = proofLabelForArtifact(baseArtifact(), sha('skill-bytes'))
    expect(label.label).toBe('unproven')
    expect(label.taskCount).toBe(0)
    expect(label.reasons[0]).toContain('legacy/single-task')
  })

  it('rejects a STALE artifact whose hash no longer matches the draft', () => {
    const artifact = baseArtifact({
      skill_content_sha256: sha('old-bytes'),
      tasks: manifest(),
    } as Partial<SkillProofArtifact>)
    const label = proofLabelForArtifact(artifact, sha('new-bytes'))
    expect(label.label).toBe('unproven')
    expect(label.reasons.join(' ')).toContain('stale')
  })

  it('rejects a manifest containing a regressed task', () => {
    const artifact = baseArtifact({
      skill_content_sha256: sha('skill-bytes'),
      tasks: manifest({ regressed: true }),
    } as Partial<SkillProofArtifact>)
    const label = proofLabelForArtifact(artifact, sha('skill-bytes'))
    expect(label.label).toBe('unproven')
    expect(label.reasons.join(' ')).toContain('regressed')
  })

  it('rejects a null artifact and an unactivated artifact', () => {
    expect(proofLabelForArtifact(null, sha('x')).label).toBe('unproven')
    const artifact = baseArtifact({
      skill_content_sha256: sha('skill-bytes'),
      tasks: manifest(),
      activation_verified: false,
    } as Partial<SkillProofArtifact>)
    const label = proofLabelForArtifact(artifact, sha('skill-bytes'))
    expect(label.label).toBe('unproven')
    expect(label.reasons.join(' ')).toContain('activation')
  })

  it('the manifest schema requires aligned role + paired-run fields', () => {
    expect(
      proofContentBlockSchema.safeParse({
        skill_content_sha256: sha('x'),
        tasks: [{ task_id: 't', role: 'other', baseline_pass_rate: 0, active_pass_rate: 0, regressed: false }],
      }).success,
    ).toBe(false)
  })
})

import {
  evaluateProposalGate,
  formatProposalLabel,
} from '@savant-code/common/util/skill-proposal-gate'
import { describe, expect, test } from 'bun:test'

import { gateReceiptFromArtifact } from '../src/prove/proposal-gate-bridge'
import {
  proofArtifactSchema,
  evaluateSkillEfficacy,
} from '../src/stats/skill-efficacy'

import type { SkillProofArtifact } from '../src/stats/skill-efficacy'

function artifact(
  overrides: Partial<SkillProofArtifact> = {},
): SkillProofArtifact {
  const base = evaluateSkillEfficacy({
    skillName: 'p',
    taskId: 't',
    baseline: [
      { index: 0, passed: false, trace_sha256: '0'.repeat(64) },
      { index: 1, passed: false, trace_sha256: '1'.repeat(64) },
      { index: 2, passed: false, trace_sha256: '2'.repeat(64) },
    ],
    active: [
      { index: 0, passed: true, activated: true, trace_sha256: '3'.repeat(64) },
      { index: 1, passed: true, activated: true, trace_sha256: '4'.repeat(64) },
      { index: 2, passed: true, activated: true, trace_sha256: '5'.repeat(64) },
    ],
    k: 1,
    ztapMode: 'off',
  })
  return { ...base, ...overrides } as SkillProofArtifact
}

describe('FID-2026-0912-004: artifact → gate-receipt bridge (evals)', () => {
  test('maps the zod artifact onto the shared receipt', () => {
    const a = proofArtifactSchema.parse(artifact())
    const receipt = gateReceiptFromArtifact(a)
    expect(receipt.baseline).toHaveLength(3)
    expect(receipt.active).toHaveLength(3)
    expect(receipt.activationVerified).toBe(true)
    expect(receipt.activeTrialCount).toBe(3)
  })
})

describe('FID-2026-0912-004: per-task no-regression criterion (evals)', () => {
  test('a mean-lift proposal with a baseline pass is REJECTED by the gate', () => {
    const a = proofArtifactSchema.parse(
      artifact({
        // The evaluator-gaming shape: mean lift is positive (1/3 → 2/3) but
        // the active arm FLIPS baseline index 1 from pass to fail.
        trials: {
          baseline: [
            { index: 0, passed: false, trace_sha256: '0'.repeat(64) },
            { index: 1, passed: true, trace_sha256: '1'.repeat(64) },
            { index: 2, passed: false, trace_sha256: '2'.repeat(64) },
          ],
          active: [
            {
              index: 0,
              passed: true,
              activated: true,
              trace_sha256: '3'.repeat(64),
            },
            {
              index: 1,
              passed: false,
              activated: true,
              trace_sha256: '4'.repeat(64),
            },
            {
              index: 2,
              passed: true,
              activated: true,
              trace_sha256: '5'.repeat(64),
            },
          ],
        },
      }),
    )
    const gate = evaluateProposalGate(gateReceiptFromArtifact(a))
    expect(gate.meanLift).toBeGreaterThan(0)
    expect(gate.accepted).toBe(false)
    expect(gate.reasons.some((r) => r.includes('regression'))).toBe(true)
  })

  test('a strict improvement with zero regressions is accepted', () => {
    const a = proofArtifactSchema.parse(artifact())
    const gate = evaluateProposalGate(gateReceiptFromArtifact(a))
    expect(gate.accepted).toBe(true)
  })

  test('no-regression is conjunctive with mean lift, not a substitute', () => {
    const a = proofArtifactSchema.parse(artifact())
    const gate = evaluateProposalGate(gateReceiptFromArtifact(a))
    expect(gate.meanLift).toBeGreaterThan(0)
    expect(gate.perTaskRegressions).toBe(0)
    expect(gate.accepted).toBe(true)
  })
})

describe('FID-2026-0912-004: honest labels (cli rendering contract)', () => {
  test('PROVEN requires a receipt with accepted gate', () => {
    expect(formatProposalLabel({ accepted: true })).toBe('[✓ PROVEN]')
  })

  test('UNPROVEN covers absent, rejected, and errored receipts', () => {
    expect(formatProposalLabel(null)).toBe('[⚠ UNPROVEN — TRUSTING BLIND]')
    expect(formatProposalLabel({ accepted: false })).toBe(
      '[⚠ UNPROVEN — TRUSTING BLIND]',
    )
  })
})

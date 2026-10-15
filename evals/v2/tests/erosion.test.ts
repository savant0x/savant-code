import { describe, expect, it } from 'bun:test'

import {
  compareErosion,
  pctChange,
  structuralScore,
} from '../src/erosion/delta'
import { evaluateErosionGate } from '../src/erosion/gate'
import {
  couplingConcentration,
  cyclomaticEstimate,
  snapshotErosion,
  volumeRatio,
} from '../src/erosion/metrics'
import { proofArtifactSchema } from '../src/stats/skill-efficacy'

import type { ErosionSnapshot, FileStat } from '../src/erosion/metrics'

// FID-2026-0824-018 fixtures — every expected value below is hand-computed.

const FILE_A: FileStat = {
  path: 'a.ts',
  numLines: 100,
  identifierCount: 9,
  maxFanIn: 8,
  meanFanIn: 2,
  decisionCount: 4,
}

const FILE_B: FileStat = {
  path: 'b.ts',
  numLines: 30,
  identifierCount: 19,
  maxFanIn: 2,
  meanFanIn: 0,
  decisionCount: 0,
}

/** Aggregates to: lines 130 · meanVR (10+1.5)/2=5.75 · maxCC 5 · coupling 8/2=4. */
const SNAPSHOT: ErosionSnapshot = snapshotErosion([FILE_A, FILE_B])

describe('erosion metrics (FID-2026-0824-018)', () => {
  it('volumeRatio divides lines by identifiers+1 and clamps negatives', () => {
    expect(volumeRatio(100, 9)).toBe(10)
    expect(volumeRatio(10, 0)).toBe(10)
    expect(volumeRatio(0, 5)).toBe(0)
    expect(volumeRatio(-5, -5)).toBe(0)
    expect(volumeRatio(-10, -2)).toBe(0)
  })

  it('cyclomaticEstimate applies decisions+1 with a zero floor', () => {
    expect(cyclomaticEstimate(0)).toBe(1)
    expect(cyclomaticEstimate(7)).toBe(8)
    expect(cyclomaticEstimate(-3)).toBe(1)
  })

  it('couplingConcentration scales peak fan-in over mean fan-in (+1 floor)', () => {
    expect(couplingConcentration(0, 0)).toBe(0)
    expect(couplingConcentration(10, 2)).toBeCloseTo(10 / 3, 5)
  })

  it('snapshotErosion aggregates hand-computed fixture values', () => {
    expect(SNAPSHOT.fileCount).toBe(2)
    expect(SNAPSHOT.totalLines).toBe(130)
    expect(SNAPSHOT.meanVolumeRatio).toBe(5.75)
    expect(SNAPSHOT.maxCyclomaticEstimate).toBe(5)
    expect(SNAPSHOT.couplingConcentration).toBe(4)
  })

  it('snapshotErosion of an empty set degrades to a zero snapshot', () => {
    expect(snapshotErosion([])).toEqual({
      fileCount: 0,
      totalLines: 0,
      meanVolumeRatio: 0,
      maxCyclomaticEstimate: 0,
      couplingConcentration: 0,
    })
  })
})

describe('erosion delta (FID-2026-0824-018)', () => {
  it('pctChange rounds to 2 decimals and guards zero baselines', () => {
    expect(pctChange(3, 4)).toBe(33.33)
    expect(pctChange(4, 3)).toBe(-25)
    expect(pctChange(0, 10)).toBe(0)
    expect(pctChange(-1, 10)).toBe(0)
  })

  it('structuralScore is maxCC times (1 + coupling)', () => {
    expect(structuralScore(SNAPSHOT)).toBe(25)
  })

  it('compareErosion yields the paired percentage deltas', () => {
    const active: ErosionSnapshot = {
      ...SNAPSHOT,
      fileCount: 3,
      totalLines: 300,
      meanVolumeRatio: 7.475,
      maxCyclomaticEstimate: 6,
    }
    // verbosity: (7.475-5.75)/5.75 = +30%; structural: 5*(1+4)=25 → 6*(1+4)=30 → +20%
    expect(compareErosion(SNAPSHOT, active)).toEqual({
      verbosity_delta_pct: 30,
      structural_erosion_pct: 20,
    })
  })
})

describe('erosion gate (FID-2026-0824-018)', () => {
  it('blocks when structural erosion alone exceeds its threshold', () => {
    const result = evaluateErosionGate({
      verbosity_delta_pct: 1,
      structural_erosion_pct: 5.01,
    })
    expect(result.blocked).toBe(true)
    expect(result.reasons[0]).toContain('structural erosion')
  })

  it('blocks when verbosity delta alone exceeds its threshold', () => {
    const result = evaluateErosionGate({
      verbosity_delta_pct: 25.5,
      structural_erosion_pct: 1,
    })
    expect(result.blocked).toBe(true)
    expect(result.reasons[0]).toContain('verbosity')
  })

  it('blocks on pass^k degradation even with clean deltas', () => {
    const result = evaluateErosionGate({
      verbosity_delta_pct: 0,
      structural_erosion_pct: 0,
      baselinePassPowK: 0.9,
      activePassPowK: 0.8,
    })
    expect(result.blocked).toBe(true)
    expect(result.reasons[0]).toContain('pass^k')
  })

  it('does not block on pass^k improvement or missing values', () => {
    const improved = evaluateErosionGate({
      verbosity_delta_pct: 0,
      structural_erosion_pct: 0,
      baselinePassPowK: 0.8,
      activePassPowK: 0.9,
    })
    const absent = evaluateErosionGate({
      verbosity_delta_pct: 0,
      structural_erosion_pct: 0,
    })
    expect(improved.blocked).toBe(false)
    expect(absent.blocked).toBe(false)
  })

  it('stays within thresholds under the documented defaults', () => {
    const result = evaluateErosionGate({
      verbosity_delta_pct: 25,
      structural_erosion_pct: 5,
    })
    expect(result.blocked).toBe(false)
  })

  it('disabled short-circuits even on gross breaches', () => {
    const result = evaluateErosionGate(
      { verbosity_delta_pct: 999, structural_erosion_pct: 999 },
      { enabled: false },
    )
    expect(result.blocked).toBe(false)
    expect(result.reasons).toEqual([])
  })

  it('threshold overrides tighten the defaults', () => {
    const result = evaluateErosionGate(
      { verbosity_delta_pct: 11, structural_erosion_pct: 0 },
      { verbosityThresholdPct: 10 },
    )
    expect(result.blocked).toBe(true)
    expect(result.reasons[0]).toContain('10%')
  })
})

/** Minimal schema-valid artifact WITHOUT the optional erosion key (old shape). */
function validArtifact(): Record<string, unknown> {
  return {
    schema_version: '1.0',
    skill_name: 'demo-skill',
    task_id: 'task-1',
    generated_at: '2026-01-01T00:00:00.000Z',
    k: 2,
    trials: {
      baseline: [{ index: 0, passed: true, trace_sha256: 'a'.repeat(64) }],
      active: [
        {
          index: 0,
          passed: true,
          trace_sha256: 'b'.repeat(64),
          activated: true,
        },
      ],
    },
    metrics: {
      baseline_pass_rate: 0.5,
      active_pass_rate: 1,
      skill_lift: 0.5,
      pass_at_k: 1,
      pass_pow_k: 1,
    },
    activation_verified: true,
    gate: {
      immutable_threshold: 0.95,
      min_trials: 1,
      reliability_met: true,
      eligible_for_immutable: true,
    },
    ztap: { mode: 'off', bound: false },
  }
}

describe('proof artifact back-compat (FID-2026-0824-018)', () => {
  it('parses a v1.0 artifact written before the guard existed', () => {
    const parsed = proofArtifactSchema.parse(validArtifact())
    expect(parsed.erosion).toBeUndefined()
  })

  it('parses and preserves a full additive erosion block', () => {
    const withErosion = {
      ...validArtifact(),
      erosion: {
        measured: true,
        verbosity_delta_pct: 30,
        structural_erosion_pct: 20,
        blocked: true,
        reasons: ['structural erosion +20% exceeds threshold 5%'],
      },
    }
    const parsed = proofArtifactSchema.parse(withErosion)
    expect(parsed.erosion?.measured).toBe(true)
    expect(parsed.erosion?.blocked).toBe(true)
    expect(parsed.erosion?.reasons?.length).toBe(1)
  })
})

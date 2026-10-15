/**
 * FID-2026-0824-018 — baseline-vs-active erosion comparison.
 *
 * Verbosity Delta: percentage change of the mean volume ratio.
 * Structural Erosion: percentage change of the composite structural score
 *
 *   structuralScore = maxCyclomaticEstimate × (1 + couplingConcentration)
 *
 * which rises when peak complexity grows OR complexity concentrates into
 * fewer highly-coupled modules. A zero/absent baseline denominator yields
 * 0 pct — a degenerate measurement degrades to "no signal", never Infinity.
 */

import type { ErosionSnapshot } from './metrics'

export interface ErosionDelta {
  verbosity_delta_pct: number
  structural_erosion_pct: number
}

/** Percentage change rounded to 2 decimals; zero baselines yield 0. */
export function pctChange(baseline: number, active: number): number {
  if (baseline <= 0) return 0
  return round2(((active - baseline) / baseline) * 100)
}

/** Composite structural pressure of one arm's snapshot (documented above). */
export function structuralScore(snapshot: ErosionSnapshot): number {
  return snapshot.maxCyclomaticEstimate * (1 + snapshot.couplingConcentration)
}

/** Compare the paired arms into the artifact-facing delta shape. */
export function compareErosion(
  baseline: ErosionSnapshot,
  active: ErosionSnapshot,
): ErosionDelta {
  return {
    verbosity_delta_pct: pctChange(
      baseline.meanVolumeRatio,
      active.meanVolumeRatio,
    ),
    structural_erosion_pct: pctChange(
      structuralScore(baseline),
      structuralScore(active),
    ),
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

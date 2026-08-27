/**
 * FID-2026-0824-018 — erosion threshold gate.
 *
 * Spec step 3: ">5% structural-erosion increase or pass^k degradation flags
 * BLOCK". The verbosity threshold is configurable with a conservative
 * default (25%) so ordinary refactors do not trip it. The result feeds the
 * ADDITIVE `erosion` block on the proof artifact; `/skills trust` renders
 * it prominently and `skills:evolve` ingests the same signal. Advisory by
 * construction (A4): nothing here blocks a write — the operator decides.
 */

import type { ErosionDelta } from './delta'

export interface ErosionGateConfig {
  enabled: boolean
  verbosityThresholdPct: number
  structuralThresholdPct: number
}

/** Module-owned defaults; mirrored as ADVISORY docs in protocol.config.yaml. */
export const DEFAULT_EROSION_GATE_CONFIG: ErosionGateConfig = {
  enabled: true,
  verbosityThresholdPct: 25,
  structuralThresholdPct: 5,
}

export interface ErosionGateInput extends ErosionDelta {
  /** Baseline-arm reliability; omit to skip the degradation check. */
  baselinePassPowK?: number
  /** Active-arm reliability; omit to skip the degradation check. */
  activePassPowK?: number
}

export interface ErosionGateResult {
  blocked: boolean
  reasons: string[]
}

/** Evaluate the gate; every breached threshold produces its own reason. */
export function evaluateErosionGate(
  input: ErosionGateInput,
  overrides: Partial<ErosionGateConfig> = {},
): ErosionGateResult {
  const config: ErosionGateConfig = {
    ...DEFAULT_EROSION_GATE_CONFIG,
    ...overrides,
  }
  if (!config.enabled) {
    return { blocked: false, reasons: [] }
  }
  const reasons: string[] = []
  if (input.structural_erosion_pct > config.structuralThresholdPct) {
    reasons.push(
      `structural erosion +${input.structural_erosion_pct}% exceeds threshold ${config.structuralThresholdPct}%`,
    )
  }
  if (input.verbosity_delta_pct > config.verbosityThresholdPct) {
    reasons.push(
      `verbosity delta +${input.verbosity_delta_pct}% exceeds threshold ${config.verbosityThresholdPct}%`,
    )
  }
  if (
    input.baselinePassPowK !== undefined &&
    input.activePassPowK !== undefined &&
    input.activePassPowK < input.baselinePassPowK
  ) {
    reasons.push(
      `pass^k reliability degraded (${input.baselinePassPowK} → ${input.activePassPowK})`,
    )
  }
  return { blocked: reasons.length > 0, reasons }
}

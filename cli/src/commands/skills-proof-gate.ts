import * as fs from 'node:fs'
import * as path from 'node:path'

// FID-2026-0819-005 Loop 143: proof + erosion advisory cluster, extracted
// from skills.ts (FID-2026-0824-016/-018). Reads
// `.savant/skill-proofs/<name>.json` and renders ADVISORY-only blocks;
// trust decisions stay operator-only.

export interface ProofGateSummary {
  generated_at?: string
  activation_verified?: boolean
  pass_pow_k?: number
  eligible_for_immutable?: boolean
  receipt_fingerprint?: string
  /** FID-2026-0824-018 additive erosion-guard fields. */
  erosion_blocked?: boolean
  erosion_measured?: boolean
  verbosity_delta_pct?: number
  structural_erosion_pct?: number
  erosion_reasons?: string[]
}

/**
 * FID-2026-0824-016: read `.savant/skill-proofs/<name>.json` (written by the
 * evals prove engine) and summarize its gate fields. Dependency-light by
 * design — manual field extraction, no cross-workspace import. Null when no
 * artifact exists or the file is malformed.
 */
export function readProofGate(
  projectRoot: string,
  name: string,
): ProofGateSummary | null {
  const file = path.join(projectRoot, '.savant', 'skill-proofs', `${name}.json`)
  if (!fs.existsSync(file)) return null
  try {
    const raw = JSON.parse(
      fs.readFileSync(file, 'utf8'),
    ) as Partial<ProofGateSummary> & {
      gate?: { eligible_for_immutable?: boolean }
      metrics?: { pass_pow_k?: number }
      ztap?: { receipt_fingerprint?: string }
      erosion?: {
        blocked?: boolean
        measured?: boolean
        verbosity_delta_pct?: number
        structural_erosion_pct?: number
        reasons?: string[]
      }
    }
    return {
      generated_at: raw.generated_at,
      activation_verified: raw.activation_verified,
      pass_pow_k: raw.metrics?.pass_pow_k,
      eligible_for_immutable: raw.gate?.eligible_for_immutable,
      receipt_fingerprint: raw.ztap?.receipt_fingerprint,
      erosion_blocked: raw.erosion?.blocked,
      erosion_measured: raw.erosion?.measured,
      verbosity_delta_pct: raw.erosion?.verbosity_delta_pct,
      structural_erosion_pct: raw.erosion?.structural_erosion_pct,
      erosion_reasons: raw.erosion?.reasons,
    }
  } catch {
    return null
  }
}

/** Render the ADVISORY proof-status block (trust stays operator-only). */
export function formatProofAdvisory(gate: ProofGateSummary): string {
  const verdict = gate.eligible_for_immutable
    ? '✅ ELIGIBLE for immutable promotion'
    : '⚠️ NOT yet eligible'
  return [
    '**Proof status — ADVISORY ONLY (trust stays operator-only)**',
    '```',
    `generated_at: ${gate.generated_at ?? '—'}`,
    `activation_verified: ${String(gate.activation_verified ?? false)}`,
    `pass^k reliability: ${gate.pass_pow_k != null ? String(gate.pass_pow_k) : '—'}`,
    `immutable eligibility: ${String(gate.eligible_for_immutable ?? false)} → ${verdict}`,
    gate.receipt_fingerprint
      ? `ztap receipt: ${gate.receipt_fingerprint}`
      : 'ztap receipt: _none bound_',
    '```',
  ].join('\n')
}

export function formatPct(value: number | undefined): string {
  return value == null ? '—' : `${value.toFixed(2)}%`
}

/**
 * FID-2026-0824-018: erosion advisory under the proof block. A BLOCK is
 * rendered prominently with its reasons; a clean measurement renders one
 * dim line; an absent measurement renders nothing.
 */
export function formatErosionAdvisory(gate: ProofGateSummary): string {
  if (gate.erosion_blocked === true) {
    const reasons =
      gate.erosion_reasons && gate.erosion_reasons.length > 0
        ? gate.erosion_reasons.map((reason) => `  - ${reason}`).join('\n')
        : '  - threshold breach'
    return [
      '**🚫 EROSION BLOCK — structural regression detected (ADVISORY)**',
      '',
      'The paired-run workspace eroded beyond thresholds:',
      reasons,
      '',
      '_Trust stays operator-only; consider a `skills:evolve` review first._',
    ].join('\n')
  }
  if (gate.erosion_measured !== true) return ''
  return [
    `_Erosion advisory: verbosity ${formatPct(gate.verbosity_delta_pct)}, structural ${formatPct(gate.structural_erosion_pct)} — within thresholds._`,
  ].join('\n')
}

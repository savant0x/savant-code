import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { bindZtapReceipt } from './skill-proof-file'
import { compareErosion } from '../erosion/delta'
import { evaluateErosionGate } from '../erosion/gate'
import {
  evaluateSkillEfficacy,
  passPowK,
  proofArtifactSchema,
} from '../stats/skill-efficacy'

import type { ErosionGateConfig } from '../erosion/gate'
import type { ErosionSnapshot } from '../erosion/metrics'
import type { TraceDocument } from '../runner'
import type {
  SkillProofArtifact,
  TrialOutcome,
  ZtapMode,
} from '../stats/skill-efficacy'

/** Citations of the skill name required to treat a trial as activated. */
const MIN_SKILL_CITATIONS = 2

export interface TrialRunResult {
  exitOk: boolean
  trace: TraceDocument
}

export type TrialArm = 'baseline' | 'active'

export type TrialRunner = (trial: {
  arm: TrialArm
  index: number
}) => Promise<TrialRunResult>

export interface RunSkillProveParams {
  skillName: string
  taskId: string
  /** Repo root; artifact lands at .savant/skill-proofs/<skillName>.json */
  projectRoot: string
  /** Trials per arm — local default N=3 (CI reserves N=20). */
  trialsPerArm?: number
  k?: number
  immutableThreshold?: number
  minTrials?: number
  ztapMode?: ZtapMode
  /** Provenance session dir override (default <root>/.savant/provenance). */
  sessionDir?: string
  /** Seam for tests and runners: one isolated hardened-sandbox trial. */
  runTrial: TrialRunner
  /**
   * FID-2026-0824-018 seam: measure the post-trial workspace per arm.
   * When provided AND both arms return snapshots, the artifact gains the
   * additive `erosion` block; otherwise output is unchanged (back-compat).
   */
  measureErosion?: (arm: TrialArm) => ErosionSnapshot | null
  /** Erosion-gate threshold overrides (defaults in erosion/gate.ts). */
  erosionGate?: Partial<ErosionGateConfig>
}

/**
 * Canonical trace fingerprint: sha256 over the serialized EVENTS ONLY.
 * run_id/started_at/metadata are deliberately excluded so identical event
 * streams hash identically across arms and reruns.
 */
function hashTrace(trace: TraceDocument): string {
  return createHash('sha256').update(JSON.stringify(trace.events)).digest('hex')
}

/**
 * Coder-Eval-adapted activation heuristic (FID-2026-0824-016): the skill
 * must be CITED in the trace beyond incidental noise — its name appears at
 * least twice across serialized events (load + cite). Deterministic;
 * tasks progressively pin it via -014 trajectory assertions.
 */
export function scanActivation(
  trace: TraceDocument,
  skillName: string,
): boolean {
  const haystack = JSON.stringify(trace.events).toLowerCase()
  const needle = skillName.toLowerCase()
  let count = 0
  let at = haystack.indexOf(needle)
  while (at !== -1) {
    count += 1
    at = haystack.indexOf(needle, at + needle.length)
  }
  return count >= MIN_SKILL_CITATIONS
}

/**
 * FID-2026-0824-018: attach the additive erosion block when both arms were
 * measured. Deltas come from compareErosion; pass^k degradation compares
 * baseline-rate reliability against the active arm's measured pass^k.
 * Either arm returning null degrades to "no signal" — artifact unchanged.
 */
export function attachErosionBlock(
  artifact: SkillProofArtifact,
  measureErosion: (arm: TrialArm) => ErosionSnapshot | null,
  gateOverrides?: Partial<ErosionGateConfig>,
): SkillProofArtifact {
  const baseline = measureErosion('baseline')
  const active = measureErosion('active')
  if (!baseline || !active) return artifact
  const delta = compareErosion(baseline, active)
  const gateResult = evaluateErosionGate(
    {
      ...delta,
      baselinePassPowK: passPowK(
        artifact.metrics.baseline_pass_rate,
        artifact.k,
      ),
      activePassPowK: artifact.metrics.pass_pow_k,
    },
    gateOverrides,
  )
  return {
    ...artifact,
    erosion: {
      measured: true,
      verbosity_delta_pct: delta.verbosity_delta_pct,
      structural_erosion_pct: delta.structural_erosion_pct,
      blocked: gateResult.blocked,
      reasons: gateResult.reasons,
    },
  }
}

/**
 * Execute N paired isolated trials and write the signed-shape proof
 * artifact to `.savant/skill-proofs/<skillName>.json`.
 *
 * Baseline arm runs FIRST so an active-arm crash cannot contaminate the
 * control measurements (paired design, fixed order per spec).
 *
 * Fail-fast contract: a rejecting runTrial aborts the whole prove run and
 * propagates — no artifact is written for a partial measurement, because a
 * truncated paired set would silently skew lift and reliability metrics.
 */
export async function runSkillProve(params: RunSkillProveParams): Promise<{
  artifact: SkillProofArtifact
  artifactPath: string
}> {
  const trialsPerArm = Math.max(1, params.trialsPerArm ?? 3)
  const k = params.k ?? trialsPerArm
  const outcomes: Record<TrialArm, TrialOutcome[]> = {
    baseline: [],
    active: [],
  }

  for (const arm of ['baseline', 'active'] as const) {
    for (let index = 0; index < trialsPerArm; index++) {
      const run = await params.runTrial({ arm, index })
      const outcome: TrialOutcome = {
        index,
        passed: run.exitOk,
        trace_sha256: hashTrace(run.trace),
        ...(arm === 'active'
          ? { activated: scanActivation(run.trace, params.skillName) }
          : {}),
      }
      outcomes[arm].push(outcome)
    }
  }

  const artifact = evaluateSkillEfficacy({
    skillName: params.skillName,
    taskId: params.taskId,
    baseline: outcomes.baseline,
    active: outcomes.active,
    k,
    ztapMode: params.ztapMode ?? 'record',
    immutableThreshold: params.immutableThreshold,
    minTrials: params.minTrials,
  })

  // FID-2026-0824-018: the optional erosion guard attaches its additive
  // block BEFORE the round-trip so disk output always re-parses with it.
  const guarded =
    params.measureErosion === undefined
      ? artifact
      : attachErosionBlock(artifact, params.measureErosion, params.erosionGate)
  // Round-trip guarantee: what lands on disk always re-parses.
  const parsed = proofArtifactSchema.parse(guarded)
  const artifactPath = path.join(
    params.projectRoot,
    '.savant',
    'skill-proofs',
    `${params.skillName}.json`,
  )
  await mkdir(path.dirname(artifactPath), { recursive: true })
  await writeFile(artifactPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')

  // ZTAP binding call-site (spec step 4): bind artifact ↔ newest signed
  // provenance receipt when mode ≠ off. Fail-open inside bindZtapReceipt.
  const bound = await bindZtapReceipt({
    projectRoot: params.projectRoot,
    skillName: params.skillName,
    ztapMode: params.ztapMode ?? 'record',
    ...(params.sessionDir !== undefined
      ? { sessionDir: params.sessionDir }
      : {}),
  })

  return { artifact: bound ?? parsed, artifactPath }
}

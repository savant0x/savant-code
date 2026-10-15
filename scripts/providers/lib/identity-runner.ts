/**
 * FID-2026-1007-008 — the gauntlet runner. Pure: the probe transport is
 * injected, so this file makes no request and its rules are pinned offline.
 */
import {
  IDENTITY_VECTORS,
  normalizeText,
  redactSample,
  stableTextHash,
  tokenizerOverhead,
} from './identity-core'

import type {
  GauntletReport,
  IdentityTarget,
  IdentityVector,
  ProbeManifest,
  ProbeSample,
  ProbeSpec,
  ProbeInvoker,
  VectorFinding,
} from './identity-core'

export interface GauntletRunOptions {
  manifest: ProbeManifest
  invoke: ProbeInvoker
  now?: () => number
  /** Held-out calibration. Absent = no composite score is emitted at all. */
  calibration?: { positiveRate: number; negativeRate: number }
}

/** Per-vector evidence. Vectors are reported separately, never blended. */
function finding(
  vector: IdentityVector,
  specs: readonly ProbeSpec[],
  samples: readonly ProbeSample[],
): VectorFinding {
  const ids = new Set(specs.map((spec) => spec.id))
  const own = samples.filter((sample) => ids.has(sample.probeId))
  const completed = own.filter((sample) => sample.failure === undefined)
  const evidence: string[] = []
  if (own.length === 0) {
    return {
      vector,
      probes: 0,
      completed: 0,
      status: 'no-signal',
      evidence: ['no probes ran for this vector'],
    }
  }
  if (completed.length === 0) {
    const classes = [...new Set(own.map((s) => s.failure?.class ?? 'failed'))]
    return {
      vector,
      probes: own.length,
      completed: 0,
      status: 'no-signal',
      evidence: [`no probe completed (${classes.join(', ')})`],
    }
  }
  let breaches = 0
  let evaluated = 0
  if (vector === 'A') {
    for (const sample of completed) {
      const reported = sample.usage?.inputTokens
      // A provider that reports no usage is not evidence of substitution — it
      // is an absent signal, and saying otherwise would be the exact
      // false-positive the research warns about.
      if (typeof reported !== 'number') continue
      evaluated++
      const local = Math.max(
        1,
        Math.round(normalizeText(sample.text).length / 4),
      )
      const check = tokenizerOverhead(reported, local)
      if (check === null) continue
      if (!check.withinBand) breaches++
      evidence.push(
        `probe ${sample.probeId}: reported ${reported} vs local~${local} (ratio ${check.ratio.toFixed(2)})`,
      )
    }
    if (evaluated === 0) {
      return {
        vector,
        probes: own.length,
        completed: completed.length,
        status: 'no-signal',
        evidence: ['the provider reported no token usage for this vector'],
      }
    }
    if (breaches > 0) {
      evidence.push(`${breaches} probe(s) outside the tokenizer band`)
    }
  } else if (vector === 'E') {
    const latencies = completed.map((sample) => sample.latencyMs)
    evidence.push(
      `latency observed ${Math.min(...latencies)}–${Math.max(...latencies)}ms (operational data only; latency does not identify hardware)`,
    )
  } else {
    const distinct = new Set(completed.map((s) => stableTextHash(s.text)))
    evidence.push(
      `${completed.length} completed probe(s), ${distinct.size} distinct normalized response(s)`,
    )
  }
  return {
    vector,
    probes: own.length,
    completed: completed.length,
    status: breaches > 0 ? 'inconsistent' : 'consistent',
    evidence,
  }
}

/**
 * A composite is emitted ONLY with held-out calibration, because an
 * uncalibrated 0–1 score invites a threshold nobody measured. The addendum's
 * 0.85 value is not applied, referenced or defaulted anywhere here.
 */
export function compositeFor(
  calibration: GauntletRunOptions['calibration'],
  vectors: readonly VectorFinding[],
): GauntletReport['composite'] {
  if (calibration === undefined) return undefined
  const components: Record<string, number> = {}
  for (const item of vectors) {
    components[`vector_${item.vector}`] =
      item.completed === 0 ? 0 : item.status === 'consistent' ? 1 : 0
  }
  const values = Object.values(components)
  const score =
    values.length === 0
      ? 0
      : values.reduce((total, value) => total + value, 0) / values.length
  return { score, components }
}

/**
 * Runs the manifest. A budget breach stops the run and is reported with the
 * dimension that ended it — an exhausted run is never silently truncated into
 * a pass.
 */
export async function runIdentityGauntlet(
  options: GauntletRunOptions,
): Promise<GauntletReport> {
  const now = options.now ?? Date.now
  const { manifest } = options
  const startedAt = now()
  const samples: ProbeSample[] = []
  let attemptsUsed = 0
  let tokensUsed = 0
  let exhausted = false
  let exhaustionReason: GauntletReport['exhaustionReason']

  const budgetLeft = () => {
    if (attemptsUsed >= manifest.budget.maxAttempts) return 'attempts'
    if (tokensUsed >= manifest.budget.maxTotalTokens) return 'tokens'
    if (now() - startedAt >= manifest.budget.maxWallMs) return 'wall'
    return undefined
  }

  const attempt = async (target: IdentityTarget, spec: ProbeSpec) => {
    attemptsUsed++
    try {
      const sample = await options.invoke(target, spec)
      tokensUsed +=
        (sample.usage?.inputTokens ?? 0) + (sample.usage?.outputTokens ?? 0)
      return sample
    } catch (error) {
      return {
        probeId: spec.id,
        text: '',
        latencyMs: 0,
        failure: {
          class: /timeout|timed out/i.test(String(error)) ? 'timeout' : 'error',
          message: String(error),
        },
      } satisfies ProbeSample
    }
  }

  for (const spec of manifest.probes) {
    const reason = budgetLeft()
    if (reason !== undefined) {
      exhausted = true
      exhaustionReason = reason
      break
    }
    samples.push(await attempt(manifest.target, spec))
  }

  const fingerprints = new Map(
    samples.map((sample) => [sample.probeId, stableTextHash(sample.text)]),
  )
  const controls: GauntletReport['controls'] = {}
  for (const [name, control] of [
    ['sameModel', manifest.controls?.sameModel],
    ['differentModel', manifest.controls?.differentModel],
  ] as const) {
    if (control === undefined) continue
    let matched = 0
    let completed = 0
    for (const spec of manifest.probes) {
      if (budgetLeft() !== undefined) break
      const sample = await attempt(control, spec)
      // A control that failed to answer is NOT evidence of separation — it is
      // an absent control, and an absent control forces `inconclusive`.
      if (sample.failure !== undefined) continue
      completed++
      if (fingerprints.get(spec.id) === stableTextHash(sample.text)) matched++
    }
    controls[name] =
      completed === 0
        ? 'unavailable'
        : matched * 2 >= completed
          ? 'matched'
          : 'separated'
  }

  const vectors = IDENTITY_VECTORS.map((vector) =>
    finding(
      vector,
      manifest.probes.filter((spec) => spec.vector === vector),
      samples,
    ),
  )

  const verdict = verdictFor(controls, samples)
  const evidence: string[] = [
    `${samples.filter((s) => s.failure === undefined).length} of ${manifest.probes.length} target probe(s) completed`,
    `same-model control: ${controls.sameModel ?? 'not configured'}`,
    `different-model control: ${controls.differentModel ?? 'not configured'}`,
  ]
  if (exhausted) evidence.push(`budget exhausted (${exhaustionReason})`)

  return {
    manifestVersion: manifest.version,
    target: manifest.target,
    budget: manifest.budget,
    attemptsUsed,
    tokensUsed,
    wallMs: now() - startedAt,
    exhausted,
    exhaustionReason,
    vectors,
    controls,
    verdict,
    testedClaims: [...new Set(manifest.probes.map((spec) => spec.claim))],
    evidence,
    composite: compositeFor(options.calibration, vectors),
    redactedSamples: samples.map(redactSample),
  }
}

/**
 * The verdict rule, stated once. Everything it cannot establish ends in
 * `inconclusive`:
 * - no controls configured, or a control that produced nothing → `inconclusive`
 * - fewer than two completed probes → `inconclusive` (false-positive restraint:
 *   one probe never decides)
 * - the target separating from the same-model control → `mismatch-requiring-review`
 * - the target agreeing with the same-model control and separating from the
 *   different-model control → `verified-for-tested-claims`
 */
export function verdictFor(
  controls: GauntletReport['controls'],
  samples: readonly ProbeSample[],
): GauntletReport['verdict'] {
  const completed = samples.filter((s) => s.failure === undefined).length
  const same = controls.sameModel
  const different = controls.differentModel
  if (same === undefined || different === undefined) return 'inconclusive'
  if (same === 'unavailable' || different === 'unavailable') {
    return 'inconclusive'
  }
  if (completed < 2) return 'inconclusive'
  if (same === 'separated') return 'mismatch-requiring-review'
  if (different === 'separated') return 'verified-for-tested-claims'
  return 'inconclusive'
}

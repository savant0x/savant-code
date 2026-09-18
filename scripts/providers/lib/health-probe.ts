/**
 * FID-2026-0918-001 — Stage-E health-probe phase, split from
 * lib/harvest-report-phase.ts (300-line absolute ceiling; same seam
 * discipline as the FID-2026-0915-002 phase splits — the probe/report
 * boundary is the existing seam). The block moved verbatim apart from the
 * bounded-concurrency pool wiring, which is this FID's change: tracked
 * providers are distinct endpoints, so overlapping probes does not change
 * per-host etiquette.
 */

import { healthDetail, healthVerdict } from './health'
import { probeEndpoint } from './probe-endpoint'
import { PROBE_CONCURRENCY, runWithConcurrency } from './probe-pool'

import type { lookup } from 'node:dns/promises'

export type HealthRow = { host: string; verdict: string; detail: string }
export type HealthProbeRow = {
  host: string
  verdict: string
  latencyMs: number | null
}

export type TrackedProvider = {
  id: string
  label: string
  baseUrl: string
  acceptedAt: string
}

export async function runHealthProbePhase(params: {
  tracked: TrackedProvider[]
  doProbe: boolean
  /** Injectable fetch (repo DI convention, mirrors probeEndpoint) so the
   * pooled health path is testable without network. */
  fetchImpl?: typeof fetch
  /** Injectable resolver — the trust guard DNS leg; fake in tests. */
  lookupImpl?: typeof lookup
}): Promise<{ health: HealthRow[]; healthProbes: HealthProbeRow[] }> {
  const { tracked, doProbe, fetchImpl = fetch, lookupImpl } = params
  const health: HealthRow[] = []
  const healthProbes: HealthProbeRow[] = []
  if (doProbe) {
    const healthResults = await runWithConcurrency(
      tracked,
      PROBE_CONCURRENCY,
      async (provider) => {
        // FID-2026-0916-001 (MQ4): tracked custom-provider URLs are
        // operator-stamped (an explicit trust act) — a local Ollama custom
        // must stay health-checkable.
        const result = await probeEndpoint({
          baseUrl: provider.baseUrl,
          allowPrivate: true,
          fetchImpl,
          ...(lookupImpl ? { lookupImpl } : {}),
        })
        const verdict = healthVerdict({
          reachable: result.reachable,
          modelsCount: result.modelsCount,
          boundary: result.boundary,
        })
        return { provider, result, verdict }
      },
    )
    for (const { provider, result, verdict } of healthResults) {
      health.push({
        host: provider.id,
        verdict,
        detail: `${healthDetail(verdict)} (accepted ${provider.acceptedAt})`,
      })
      healthProbes.push({
        host: provider.id,
        verdict,
        latencyMs: result.latencyMs,
      })
    }
  } else if (tracked.length > 0) {
    health.push({
      host: '(tracked providers)',
      verdict: 'skipped',
      detail: `${tracked.length} pipeline provider(s) tracked — run with --probe to health-check them`,
    })
  }
  return { health, healthProbes }
}

/**
 * FID-2026-1007-008 — the sweep. Runs the gauntlet once per catalog route and
 * aggregates the results, so the report answers "which models does this provider
 * serve, and does each serve what it claims" instead of testing one model and
 * calling the provider done.
 *
 * The per-model row is the unit of truth. A route that is down (HCNSec
 * `kimi-k3` returned 500 on 2026-10-07) is reported as that route being down,
 * never as the provider being down — the same host served `glm-5.3-flash` with
 * 200 in the same minute.
 *
 * Pure: the probe transport is injected, so this file makes no request and the
 * invariant pins hold.
 */
import { classifyServedLabel } from './identity-core'
import { runIdentityGauntlet } from './identity-runner'

import type {
  IdentityVerdictStatus,
  ProbeInvoker,
  ProbeManifest,
} from './identity-core'

export type MatrixRouteStatus = 'ok' | 'unavailable' | 'failed'
export type MatrixLabelStatus = 'match' | 'mismatch' | 'unknown'

export interface MatrixRow {
  model: string
  status: MatrixRouteStatus
  /** The failure class that stopped the route, when it did not answer. */
  failureClass?: string
  /** Distinct `model` labels the endpoint returned for this request. */
  servedModels: readonly string[]
  label: MatrixLabelStatus
  completed: number
  probes: number
  latencyMs?: number
  verdict: IdentityVerdictStatus
}

export interface MatrixReport {
  version: string
  provider: string
  rows: readonly MatrixRow[]
  summary: {
    models: number
    ok: number
    unavailable: number
    failed: number
    labelMatch: number
    labelMismatch: number
  }
}

/**
 * A quota/credit refusal is "unavailable" (funding), not "failed" (the route is
 * broken). Distinguishing them is the difference between "top up" and "this
 * model is gone".
 */
const QUOTA_CLASS = /402|429|quota|insufficient|credit/i

export interface MatrixOptions {
  version: string
  provider: string
  targets: readonly { model: string }[]
  /** Builds the per-model manifest; the caller owns probes and controls. */
  buildManifest: (model: string) => ProbeManifest
  invoke: ProbeInvoker
  now?: () => number
}

export async function runIdentityMatrix(
  options: MatrixOptions,
): Promise<MatrixReport> {
  const rows: MatrixRow[] = []
  for (const target of options.targets) {
    const report = await runIdentityGauntlet({
      manifest: options.buildManifest(target.model),
      invoke: options.invoke,
      now: options.now,
    })
    const samples = report.redactedSamples
    const completed = samples.filter((sample) => sample.failure === undefined)
    const servedModels = [
      ...new Set(
        completed
          .map((sample) => sample.servedModel)
          .filter(
            (model): model is string =>
              model !== undefined && model.trim() !== '',
          ),
      ),
    ]
    const latencies = completed.map((sample) => sample.latencyMs)
    const failureClass = samples.find((sample) => sample.failure !== undefined)
      ?.failure?.class
    rows.push({
      model: target.model,
      status:
        completed.length > 0
          ? 'ok'
          : failureClass !== undefined && QUOTA_CLASS.test(failureClass)
            ? 'unavailable'
            : 'failed',
      failureClass,
      servedModels,
      label: classifyServedLabel(target.model, servedModels[0]),
      completed: completed.length,
      probes: samples.length,
      latencyMs: latencies.length > 0 ? Math.min(...latencies) : undefined,
      verdict: report.verdict,
    })
  }
  const count = (predicate: (row: MatrixRow) => boolean): number =>
    rows.filter(predicate).length
  return {
    version: options.version,
    provider: options.provider,
    rows,
    summary: {
      models: rows.length,
      ok: count((row) => row.status === 'ok'),
      unavailable: count((row) => row.status === 'unavailable'),
      failed: count((row) => row.status === 'failed'),
      labelMatch: count((row) => row.label === 'match'),
      labelMismatch: count((row) => row.label === 'mismatch'),
    },
  }
}

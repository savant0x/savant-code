/**
 * FID-2026-1005-008 — truthful quota states (converged design decision 2).
 *
 * Hard rules (the measured reference telemetry design):
 * - `exhausted` requires an OBSERVED zero/at-limit reading from a fact
 *   source — never from an estimate, never from absence of data.
 * - `unknown` is not `exhausted` and disables nothing.
 * - Source-absent readings (`no quota endpoint declared`, `no key
 *   configured`, `no numeric reading`) are `unknown`; source-DOWN readings
 *   (timeout, request failed, HTTP errors, origin mismatch) are
 *   `unavailable`. The two were conflated before this FID.
 * - Local estimates are never presented as provider billing data.
 */

import type { ProviderQuotaResult } from './provider-quota'

export type QuotaState =
  | 'healthy'
  | 'approaching_limit'
  | 'exhausted'
  | 'unavailable'
  | 'unknown'

/** How the reading is known, in the reference preference order. */
export type QuotaEvidenceSource =
  | 'official-api'
  | 'authenticated-usage-api'
  | 'mapped-header'
  | 'config'
  | 'local-estimate'
  | 'none'

export const EVIDENCE_SOURCE_PREFERENCE: readonly QuotaEvidenceSource[] = [
  'official-api',
  'authenticated-usage-api',
  'mapped-header',
  'config',
  'local-estimate',
  'none',
]

const ESTIMATE_SOURCES: ReadonlySet<QuotaEvidenceSource> = new Set([
  'local-estimate',
  'none',
])

export interface QuotaStateReading {
  state: QuotaState
  source: QuotaEvidenceSource
}

/** Source-absent `unavailable` details (they carry no account fact). */
function isSourceAbsent(detail: string): boolean {
  return (
    detail.startsWith('no quota endpoint') ||
    detail.startsWith('no key configured') ||
    detail.startsWith('no numeric reading')
  )
}

/**
 * Resolve one fetch result to a truth state + evidence source. Pure; the
 * truth table is pinned by `quota-state-truthfulness.test.ts`. Callers tag
 * the source; the default matches what `readProviderQuota` actually calls
 * (a key-scoped provider endpoint).
 */
export function resolveQuotaState(
  reading: ProviderQuotaResult,
  source: QuotaEvidenceSource = 'authenticated-usage-api',
): QuotaStateReading {
  if (reading.status === 'unavailable') {
    return isSourceAbsent(reading.detail)
      ? { state: 'unknown', source: 'none' }
      : { state: 'unavailable', source }
  }
  const atLimit =
    reading.limit !== undefined &&
    reading.limit > 0 &&
    reading.amount !== undefined &&
    reading.amount >= reading.limit
  const observedZeroOrLimit = reading.amount === 0 || atLimit
  if (ESTIMATE_SOURCES.has(source)) {
    // Estimates can never mint `exhausted` — only approach or stay unknown.
    return observedZeroOrLimit
      ? { state: 'unknown', source }
      : { state: 'approaching_limit', source }
  }
  if (observedZeroOrLimit) return { state: 'exhausted', source }
  if (reading.amount === undefined) return { state: 'unknown', source }
  const ratio =
    reading.limit !== undefined && reading.limit > 0
      ? reading.amount / reading.limit
      : undefined
  if (ratio !== undefined && ratio <= 0.1) {
    return { state: 'approaching_limit', source }
  }
  return { state: 'healthy', source }
}

export type QuotaNoticeKind = 'quota-low' | 'quota-exhausted' | 'quota-recovered'

/**
 * Notification preconditions (converged design decision 4): a quota notice
 * is lawfully emitted only on a real transition. Returns null otherwise —
 * a no-data round can never mint `quota-recovered`, and `unknown` /
 * `unavailable` emit nothing alarming.
 */
export function quotaNoticeKindForTransition(
  from: QuotaState,
  to: QuotaState,
  source: QuotaEvidenceSource,
): QuotaNoticeKind | null {
  if (to === 'exhausted' && from !== 'exhausted') return 'quota-exhausted'
  if (to === 'healthy' && from === 'exhausted') return 'quota-recovered'
  if (
    to === 'approaching_limit' &&
    from !== 'approaching_limit' &&
    !ESTIMATE_SOURCES.has(source)
  ) {
    return 'quota-low'
  }
  return null
}

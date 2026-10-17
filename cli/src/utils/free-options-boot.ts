/**
 * FID-2026-1017-005 — boot freshness resolution for the free-options panel.
 *
 * The old digest read the cache and posted before the refresh it depended on
 * had run. This module decides freshness BEFORE the panel renders: a cache no
 * older than 12 h is shown with its exact age; an older or missing cache gets
 * one bounded refresh through the existing single-flight; a failed or
 * timed-out refresh serves the cache labelled STALE, never as current.
 *
 * Pure of IO and React: readers, the clock, the refresh and the verifier are
 * injected so the matrix is testable with a fake clock and no network.
 */
import type {
  FreeOptionsArtifactCheck,
  FreeOptionsReport,
} from './free-options-types'

/** Operator ruling 2026-10-17: refresh when the cache is older than 12 h. */
export const BOOT_CACHE_MAX_AGE_MS = 12 * 3600_000
/** Covers the existing 5 s catalog fetch timeout with one second of slack. */
export const BOOT_REFRESH_BUDGET_MS = 6_000

export type FreeOptionsBootSource =
  'cache' | 'refresh' | 'stale-cache' | 'unavailable'

export type FreeOptionsBootSnapshot = {
  report: FreeOptionsReport
  source: FreeOptionsBootSource
  /** now − Date.parse(fetchedAt); null when the report has no catalog. */
  ageMs: number | null
  /** Present when a refresh failed, timed out or returned its cache fallback. */
  refreshError?: string
  artifact: FreeOptionsArtifactCheck
}

export type ResolveBootFreeOptionsDeps = {
  now: () => number
  readCached: () => FreeOptionsReport | null
  refresh: () => Promise<FreeOptionsReport>
  verify: (report: FreeOptionsReport) => FreeOptionsArtifactCheck
  budgetMs?: number
  cacheMaxAgeMs?: number
  /** Injected timeout arm; defaults to an unref'd setTimeout. */
  wait?: (ms: number) => Promise<void>
}

const TIMEOUT = { timeout: true } as const

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    timer.unref?.()
  })
}

function ageOf(report: FreeOptionsReport, nowMs: number): number | null {
  if (!report.fetchedAt) return null
  const parsed = Date.parse(report.fetchedAt)
  return Number.isNaN(parsed) ? null : Math.max(0, nowMs - parsed)
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function emptyReport(): FreeOptionsReport {
  return {
    fetchedAt: null,
    stale: false,
    catalogSource: 'none',
    configuredProviders: [],
    wiredFree: [],
    notWired: [],
    localFree: [],
  }
}

function checkArtifact(
  deps: ResolveBootFreeOptionsDeps,
  report: FreeOptionsReport,
): FreeOptionsArtifactCheck {
  try {
    return deps.verify(report)
  } catch {
    return { ok: false, path: '', reason: 'unreadable' }
  }
}

function snapshot(
  deps: ResolveBootFreeOptionsDeps,
  report: FreeOptionsReport,
  source: FreeOptionsBootSource,
  nowMs: number,
  refreshError?: string,
): FreeOptionsBootSnapshot {
  return {
    report,
    source,
    ageMs: ageOf(report, nowMs),
    ...(refreshError ? { refreshError } : {}),
    artifact: checkArtifact(deps, report),
  }
}

/** Resolve the boot snapshot. Never throws; every failure becomes a label. */
export async function resolveBootFreeOptions(
  deps: ResolveBootFreeOptionsDeps,
): Promise<FreeOptionsBootSnapshot> {
  const nowMs = deps.now()
  const budget = deps.budgetMs ?? BOOT_REFRESH_BUDGET_MS
  const maxAge = deps.cacheMaxAgeMs ?? BOOT_CACHE_MAX_AGE_MS

  let cached: FreeOptionsReport | null = null
  try {
    cached = deps.readCached()
  } catch {
    cached = null
  }
  const cachedAge = cached ? ageOf(cached, nowMs) : null
  if (cached && cachedAge !== null && cachedAge <= maxAge) {
    return snapshot(deps, cached, 'cache', nowMs)
  }

  let refreshed: FreeOptionsReport | null = null
  let refreshError: string | undefined
  try {
    const outcome: FreeOptionsReport | typeof TIMEOUT = await Promise.race([
      deps.refresh(),
      (deps.wait ?? delay)(budget).then(() => TIMEOUT),
    ])
    if ('timeout' in outcome)
      refreshError = `refresh exceeded ${Math.round(budget / 1000)}s`
    else refreshed = outcome
  } catch (error) {
    refreshError = errorText(error)
  }

  if (refreshed && refreshed.catalogSource === 'network') {
    return snapshot(deps, refreshed, 'refresh', nowMs)
  }
  const fallback = refreshed ?? cached
  if (!fallback) {
    return snapshot(
      deps,
      emptyReport(),
      'unavailable',
      nowMs,
      refreshError ?? 'no catalog available',
    )
  }
  if (!fallback.fetchedAt) {
    return snapshot(
      deps,
      fallback,
      'unavailable',
      nowMs,
      refreshError ?? 'catalog unreachable',
    )
  }
  return snapshot(
    deps,
    fallback,
    'stale-cache',
    nowMs,
    refreshError ?? 'refresh returned the cached catalog',
  )
}

/** Compact age for labels: `just now`, `42m`, `5h`, `3d`. */
export function formatAge(ageMs: number | null): string {
  if (ageMs === null) return 'unknown age'
  if (ageMs < 60_000) return 'just now'
  const minutes = Math.floor(ageMs / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

/** The one freshness sentence every boot surface uses. */
export function bootFreshnessLabel(snapshot: FreeOptionsBootSnapshot): string {
  switch (snapshot.source) {
    case 'refresh':
      return 'refreshed just now'
    case 'cache':
      return `fresh · cached ${formatAge(snapshot.ageMs)} ago`
    case 'stale-cache':
      return `STALE · ${formatAge(snapshot.ageMs)} old · refresh failed`
    case 'unavailable':
      return 'catalog unavailable'
  }
}

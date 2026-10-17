/**
 * FID-2026-1017-005 — boot freshness matrix.
 *
 * The resolver decides before the panel posts: a cache no older than 12 h is
 * shown with its exact age; an older or absent cache gets one bounded refresh;
 * a failed or timed-out refresh serves the cache labelled STALE. Every reader
 * is injected, so these pins need no network and no config directory.
 */
import { describe, expect, test } from 'bun:test'

import { buildFreeOptionsReport } from '../free-options'
import {
  BOOT_CACHE_MAX_AGE_MS,
  BOOT_REFRESH_BUDGET_MS,
  bootFreshnessLabel,
  formatAge,
  resolveBootFreeOptions,
} from '../free-options-boot'
import { CATALOG, CTX } from './free-options-test-fixtures'

import type {
  FreeOptionsArtifactCheck,
  FreeOptionsReport,
} from '../free-options-types'

const NOW = CTX.nowMs
const PATH = '/tmp/savant-free-test/free-options.md'
const VERIFIED: FreeOptionsArtifactCheck = {
  ok: true,
  path: PATH,
  generatedAt: '2026-09-28T12:00:00.000Z',
  generationId: 'sha256:abc',
}

function reportAt(fetchedAt: string | null): FreeOptionsReport {
  const base = buildFreeOptionsReport(CATALOG, CTX)
  return {
    ...base,
    fetchedAt,
    catalogSource: fetchedAt ? 'cache' : 'none',
    discoveryOffers: [],
    discoveryOffersEndingSoon: 0,
  }
}

function cacheAged(hours: number): FreeOptionsReport {
  return reportAt(new Date(NOW - hours * 3600_000).toISOString())
}

function deps(over: {
  cached?: FreeOptionsReport | null
  refresh?: () => Promise<FreeOptionsReport>
  verify?: (report: FreeOptionsReport) => FreeOptionsArtifactCheck
  wait?: (ms: number) => Promise<void>
  budgetMs?: number
}) {
  return {
    now: () => NOW,
    readCached: () => over.cached ?? null,
    refresh:
      over.refresh ??
      (() => {
        throw new Error('refresh must not be called')
      }),
    verify: over.verify ?? (() => VERIFIED),
    ...(over.wait ? { wait: over.wait } : {}),
    ...(over.budgetMs !== undefined ? { budgetMs: over.budgetMs } : {}),
  }
}

describe('FID-2026-1017-005: boot freshness', () => {
  test('a cache within 12h is shown as-is, with its exact age and no fetch', async () => {
    const snapshot = await resolveBootFreeOptions(
      deps({ cached: cacheAged(3) }),
    )
    expect(snapshot.source).toBe('cache')
    expect(snapshot.ageMs).toBe(3 * 3600_000)
    expect(bootFreshnessLabel(snapshot)).toBe('fresh · cached 3h ago')
  })

  test('a 13h cache triggers one refresh and renders the refreshed catalog', async () => {
    const fresh = reportAt(new Date(NOW - 60_000).toISOString())
    fresh.catalogSource = 'network'
    let calls = 0
    const snapshot = await resolveBootFreeOptions(
      deps({
        cached: cacheAged(13),
        refresh: async () => {
          calls += 1
          return fresh
        },
      }),
    )
    expect(calls).toBe(1)
    expect(snapshot.source).toBe('refresh')
    expect(snapshot.report.fetchedAt).toBe(fresh.fetchedAt)
    expect(bootFreshnessLabel(snapshot)).toBe('refreshed just now')
  })

  test('a failed refresh keeps the cache and labels it STALE', async () => {
    const snapshot = await resolveBootFreeOptions(
      deps({
        cached: cacheAged(13),
        refresh: async () => {
          throw new Error('offline')
        },
      }),
    )
    expect(snapshot.source).toBe('stale-cache')
    expect(snapshot.refreshError).toBe('offline')
    expect(bootFreshnessLabel(snapshot)).toBe(
      'STALE · 13h old · refresh failed',
    )
  })

  test('a refresh that returns its own cache fallback is still STALE', async () => {
    const cached = cacheAged(13)
    const snapshot = await resolveBootFreeOptions(
      deps({ cached, refresh: async () => cached }),
    )
    expect(snapshot.source).toBe('stale-cache')
    expect(snapshot.refreshError).toBe('refresh returned the cached catalog')
  })

  test('no cache and no catalog is unavailable, but local lanes survive', async () => {
    const offline = reportAt(null)
    offline.localFree = [
      { id: 'ollama', label: 'Ollama', setupCommand: '/provider ollama' },
    ]
    const snapshot = await resolveBootFreeOptions(
      deps({ refresh: async () => offline }),
    )
    expect(snapshot.source).toBe('unavailable')
    expect(snapshot.report.fetchedAt).toBeNull()
    expect(snapshot.report.localFree.map((lane) => lane.id)).toEqual(['ollama'])
    expect(bootFreshnessLabel(snapshot)).toBe('catalog unavailable')
  })

  test('a rejected refresh with no cache is unavailable and never throws', async () => {
    const snapshot = await resolveBootFreeOptions(
      deps({
        refresh: async () => {
          throw new Error('ENOTFOUND')
        },
      }),
    )
    expect(snapshot.source).toBe('unavailable')
    expect(snapshot.refreshError).toBe('ENOTFOUND')
    expect(snapshot.report.wiredFree).toEqual([])
  })

  test('the budget arm returns without waiting for a hung refresh', async () => {
    const snapshot = await resolveBootFreeOptions(
      deps({
        cached: cacheAged(13),
        refresh: () => new Promise<FreeOptionsReport>(() => {}),
        wait: async () => {},
        budgetMs: 10,
      }),
    )
    expect(snapshot.source).toBe('stale-cache')
    expect(snapshot.refreshError).toContain('exceeded')
  })

  test('a throwing cache reader falls through to the refresh', async () => {
    const fresh = reportAt(new Date(NOW - 60_000).toISOString())
    fresh.catalogSource = 'network'
    const snapshot = await resolveBootFreeOptions({
      ...deps({ refresh: async () => fresh }),
      readCached: () => {
        throw new Error('corrupt')
      },
    })
    expect(snapshot.source).toBe('refresh')
  })

  test('artifact verification result and its failure reason are carried', async () => {
    const missing = await resolveBootFreeOptions(
      deps({
        cached: cacheAged(3),
        verify: () => ({ ok: false, path: PATH, reason: 'missing' }),
      }),
    )
    expect(missing.artifact).toEqual({
      ok: false,
      path: PATH,
      reason: 'missing',
    })
  })

  test('the thresholds are the operator ruling and cover the fetch timeout', () => {
    expect(BOOT_CACHE_MAX_AGE_MS).toBe(12 * 3600_000)
    expect(BOOT_REFRESH_BUDGET_MS).toBeGreaterThan(5_000)
  })

  test('age formatting is compact and honest about unknown data', () => {
    expect(formatAge(null)).toBe('unknown age')
    expect(formatAge(30_000)).toBe('just now')
    expect(formatAge(42 * 60_000)).toBe('42m')
    expect(formatAge(5 * 3600_000)).toBe('5h')
    expect(formatAge(3 * 24 * 3600_000)).toBe('3d')
  })
})

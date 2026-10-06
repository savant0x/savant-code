import { WINDOW_COVERAGE_REGISTER } from '@savant-code/common/constants/window-coverage-register'
import { describe, expect, test } from 'bun:test'

import {
  REFRESH_COOLDOWN_MS,
  __resetGatewayRefreshCooldownForTest,
  computeGaps,
  gatewayRefreshCooledDown,
  liveProviderIds,
  markGatewayRefreshAttempt,
  rowProviderIds,
  staleWindowCoverageLiveProviders,
} from '../gateway-coverage'

import type { OpenRouterModel } from '../types'
import type { WindowCoverageEntry } from '@savant-code/common/constants/window-coverage-register'

/** A fixture register with two stale `no-runtime-rows` live providers. */
const FIXTURE_REGISTER = new Map<string, WindowCoverageEntry>([
  ['codecraft', { disposition: 'no-runtime-rows', note: 'fixture' }],
  ['cleanapis', { disposition: 'no-runtime-rows', note: 'fixture' }],
])

function catalogWith(...rows: Array<[string, string]>): OpenRouterModel[] {
  return rows.map(([provider, id]) => ({ id: `${provider}/${id}`, name: id }))
}

describe('gateway coverage validation (FID-2026-1006-001 M2)', () => {
  test('rowProviderIds collects present provider prefixes', () => {
    const catalog = catalogWith(
      ['codecraft', 'claude-5'],
      ['cleanapis', 'gpt-6'],
    )
    expect(rowProviderIds(catalog)).toEqual(new Set(['codecraft', 'cleanapis']))
  })

  test('computeGaps flags only keyed providers missing rows', () => {
    const catalog = catalogWith(['codecraft', 'claude-5'])
    expect(
      computeGaps(catalog, new Set(['cleanapis']), ['codecraft', 'cleanapis']),
    ).toEqual(['cleanapis'])
    // No key = never a gap (provider awaits key, not a cache defect).
    expect(computeGaps(catalog, new Set(), ['codecraft', 'cleanapis'])).toEqual(
      [],
    )
    expect(
      computeGaps(catalog, new Set(['codecraft']), ['codecraft', 'cleanapis']),
    ).toEqual([])
  })

  test('liveProviderIds includes live providers and excludes static', () => {
    const live = liveProviderIds()
    expect(live).toContain('codecraft')
    expect(live).toContain('openrouter')
    expect(live).not.toContain('tokenrouter')
  })

  test('refresh cooldown gates rebuild attempts', () => {
    __resetGatewayRefreshCooldownForTest()
    expect(gatewayRefreshCooledDown(0)).toBe(false)
    markGatewayRefreshAttempt(1_000)
    expect(gatewayRefreshCooledDown(1_000)).toBe(true)
    expect(gatewayRefreshCooledDown(1_000 + REFRESH_COOLDOWN_MS)).toBe(false)
    __resetGatewayRefreshCooldownForTest()
  })

  test('staleWindowCoverageLiveProviders flags no-runtime-rows providers with rows', async () => {
    const catalog = catalogWith(['codecraft', 'claude-5'])
    const stale = await staleWindowCoverageLiveProviders(
      catalog,
      FIXTURE_REGISTER,
    )
    expect(stale).toEqual(['codecraft'])
  })

  test('staleWindowCoverageLiveProviders ignores providers without rows', async () => {
    const stale = await staleWindowCoverageLiveProviders([], FIXTURE_REGISTER)
    expect(stale).toEqual([])
    const clean = await staleWindowCoverageLiveProviders(
      catalogWith(['cleanapis', 'gpt-6']),
      new Map<string, WindowCoverageEntry>([
        ['cleanapis', { disposition: 'runtime-published', note: 'fixture' }],
      ]),
    )
    expect(clean).toEqual([])
  })

  test('staleWindowCoverageLiveProviders defaults to the live register', async () => {
    // The real register must never throw; the default param is compile-checked.
    expect(Array.isArray(await staleWindowCoverageLiveProviders([]))).toBe(true)
    expect(WINDOW_COVERAGE_REGISTER.has('codecraft')).toBe(true)
  })
})

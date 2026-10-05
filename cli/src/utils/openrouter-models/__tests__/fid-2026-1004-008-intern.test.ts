/**
 * FID-2026-1004-008 — Intern InkStone (discovery-api.intern-ai.org.cn) pins.
 *
 * Locks the 10-model static-catalog integration:
 * 1. Every `intern/` id is cataloged in the common model map and served by
 *    the cli fetcher with its display name.
 * 2. Each window resolves from the fallback table to the vendor's OWN
 *    authenticated `/v1/models` publication (live-probed 2026-10-04) —
 *    never the family heuristic and never the `atria` twin's values.
 * 3. The registry entry is a static, single-protocol, setup-available
 *    gateway on the probed OpenAI-compatible base URL.
 * 4. The provider carries a window-coverage disposition and derives ZERO
 *    exception kinds — so no manifest entry may exist for it (a stale kind
 *    fails `validateProviderAudit` closed).
 */
import { CONTEXT_WINDOW_FALLBACKS } from '@savant-code/common/constants/context-windows'
import { internModels } from '@savant-code/common/constants/model-config'
import { WINDOW_COVERAGE_REGISTER } from '@savant-code/common/constants/window-coverage-register'
import { PROVIDER_EXCEPTION_MANIFEST } from '@savant-code/common/providers/provider-exception-manifest'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'
import { describe, expect, test } from 'bun:test'

import { fetchInternModels } from '../static-catalogs-gateways'

/** The vendor's own authenticated /v1/models windows, live-probed 2026-10-04. */
const PROBED_WINDOWS: ReadonlyArray<readonly [string, number]> = [
  ['intern/Agents-A1', 262_144],
  ['intern/Atria-Dawn-Preview', 524_288],
  ['intern/deepseek-v4-flash-0731', 1_048_576],
  ['intern/deepseek-v4-flash-vision', 1_048_576],
  ['intern/deepseek-v4-pro-0813', 1_048_576],
  ['intern/glm-5.3', 1_048_576],
  ['intern/intern-s2', 262_144],
  ['intern/kimi-k2.6', 262_144],
  ['intern/minimax-m3', 1_048_576],
  ['intern/qwen3.8-27b', 262_144],
]

describe('FID-2026-1004-008: intern static catalog', () => {
  test('the catalog is exactly the 10 probed ids, routing-prefixed', () => {
    const catalogIds: string[] = Object.values(internModels)
    expect(catalogIds.sort()).toEqual(PROBED_WINDOWS.map(([id]) => id).sort())
    for (const id of Object.values(internModels)) {
      expect(id.startsWith('intern/')).toBe(true)
    }
  })

  test('the cli fetcher serves every id with its pinned window', () => {
    // The window is compared against the INDEPENDENT probe oracle, not against
    // CONTEXT_WINDOW_FALLBACKS: the fetcher derives its value from that same
    // table via getContextWindowFallback, so comparing the two is a tautology
    // that cannot detect a wrong window (Verifier finding — FID-2026-1004-008
    // implementation audit).
    const probed = new Map<string, number>(PROBED_WINDOWS)
    const models = fetchInternModels()
    expect(models).toHaveLength(10)
    for (const model of models) {
      expect(model.provider).toBe('intern')
      expect(model.name.length).toBeGreaterThan(0)
      expect(model.contextLength, model.id).toBe(probed.get(model.id))
    }
  })

  test('every window is the vendor-published value from the live probe', () => {
    for (const [id, window] of PROBED_WINDOWS) {
      expect(CONTEXT_WINDOW_FALLBACKS.get(id), id).toBe(window)
    }
  })

  test('intern/Atria-Dawn-Preview is 512K here, NOT the atria twin 256K', () => {
    // Deliberate cross-deployment divergence (FID-2026-1004-008 MQ4): the
    // two entries serve the same upstream model at different windows.
    expect(CONTEXT_WINDOW_FALLBACKS.get('intern/Atria-Dawn-Preview')).toBe(
      524_288,
    )
    expect(CONTEXT_WINDOW_FALLBACKS.get('atria/Atria-Dawn-Preview')).toBe(
      262_144,
    )
  })

  test('registry entry is a static single-protocol setup-available gateway', () => {
    const entry = PROVIDER_REGISTRY.intern
    expect(entry.id).toBe('intern')
    expect(entry.label).toBe('Intern InkStone')
    expect(entry.kind).toBe('gateway')
    expect(entry.setupAvailable).toBe(true)
    expect(entry.credentials.envVar).toBe('INTERN_API_KEY')
    expect(entry.baseUrl).toBe('https://discovery-api.intern-ai.org.cn/v1')
    expect(entry.protocol).toBe('openai')
    expect(entry.idTransform).toBe('strip')
    expect(entry.catalog).toEqual({ source: 'static', modelsRef: 'intern' })
    expect(entry.domain).toBe('intern-ai.org.cn')
    expect(entry.order).toBe(4)
  })

  test('window-coverage register declares a table-section disposition', () => {
    expect(WINDOW_COVERAGE_REGISTER.get('intern')?.disposition).toBe(
      'table-section',
    )
  })

  test('no exception-manifest entry exists (this shape derives zero kinds)', () => {
    const owned = PROVIDER_EXCEPTION_MANIFEST.filter(
      (entry) => entry.providerId === 'intern',
    )
    expect(owned).toEqual([])
  })
})

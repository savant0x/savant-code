/**
 * FID-2026-0916-005 — Atria AI gateway provider pins.
 *
 * Locks the single-model static-catalog integration:
 * 1. `atria/Atria-Dawn-Preview` is cataloged in the common model map and
 *    appears in the cli fetcher + combined gateway catalog.
 * 2. The context window resolves to the vendor-published 256K from the
 *    fallback table (not the default).
 * 3. The registry entry is `setupAvailable: true` so /provider surfaces the
 *    masked ATRIA_API_KEY entry.
 */
import { CONTEXT_WINDOW_FALLBACKS } from '@savant-code/common/constants/context-windows'
import {
  atriaModels,
} from '@savant-code/common/constants/model-config'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'
import { describe, expect, test } from 'bun:test'

import { fetchAtriaModels } from '../static-catalogs-gateways'
import {
  fetchGatewayModels,
  __resetOpenRouterModelsCacheForTest,
} from '../gateway'

describe('FID-2026-0916-005: atria static catalog', () => {
  test('single model is cataloged with the internal routing prefix', () => {
    expect(Object.values(atriaModels)).toEqual(['atria/Atria-Dawn-Preview'])
  })

  test('cli fetcher serves the model with the vendor window', () => {
    const models = fetchAtriaModels()
    expect(models).toHaveLength(1)
    expect(models[0]).toEqual({
      id: 'atria/Atria-Dawn-Preview',
      name: 'Atria Dawn Preview',
      provider: 'atria',
      contextLength: 262_144,
    })
  })

  test('fallback table pins the vendor 256K window', () => {
    expect(CONTEXT_WINDOW_FALLBACKS.get('atria/Atria-Dawn-Preview')).toBe(
      262_144,
    )
  })

  test('registry entry is setupAvailable with ATRIA_API_KEY', () => {
    const entry = PROVIDER_REGISTRY.atria
    expect(entry.setupAvailable).toBe(true)
    expect(entry.credentials.envVar).toBe('ATRIA_API_KEY')
    expect(entry.baseUrl).toBe('https://api.atria-asi.ai/v1')
    expect(entry.protocol).toBe('openai')
    expect(entry.idTransform).toBe('strip')
  })
})

describe('FID-2026-0916-005: atria in the combined gateway catalog', () => {
  test('combined catalog includes the atria model (Law 4 reachability)', async () => {
    __resetOpenRouterModelsCacheForTest()
    // @ts-expect-error - mock fetch to satisfy the live catalog fetchers.
    globalThis.fetch = mock(() => Promise.resolve(makeJsonResponse({ data: [] })))

    const models = await fetchGatewayModels(true)

    expect(models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'atria/Atria-Dawn-Preview',
          provider: 'atria',
          contextLength: 262_144,
        }),
      ]),
    )
  })
})
/**
 * FID-2026-1030-005 — Paper Instruments (Ultramarine) gateway provider pins.
 *
 * Locks the single-model static-catalog integration:
 * 1. `paperinstruments/ultramarine-1-flash` is cataloged in the common model
 *    map and served by the cli fetcher.
 * 2. The context window resolves to the public deployment's 262,144 from the
 *    fallback table — NOT the 200,000 default, NOT the base
 *    GLM-5.3-Flash architecture ceiling (1,048,576) and NOT the vendor's
 *    131,072 harness compaction budget.
 * 3. The registry entry is `setupAvailable: true` so /provider surfaces the
 *    masked PAPERINSTRUMENTS_API_KEY entry, and the catalog source is static
 *    because the keyed /v1/models row publishes no window field.
 */
import { CONTEXT_WINDOW_FALLBACKS } from '@savant-code/common/constants/context-windows'
import { paperinstrumentsModels } from '@savant-code/common/constants/model-config'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'
import { describe, expect, test } from 'bun:test'

import { assembleGatewayCatalog } from '../gateway-catalog-merge'
import { fetchPaperInstrumentsModels } from '../static-catalogs-gateways'

import type { GatewayLiveCatalogs } from '../gateway-live-results'

const emptyLive: GatewayLiveCatalogs = {
  orModels: [],
  nvidiaModels: [],
  nousModels: [],
  kiosapiModels: [],
  apinexModels: [],
  openAiModels: [],
  orcarouterModels: [],
  baiModels: [],
  vercelModels: [],
  cleanApisModels: [],
  codecraftModels: [],
  mistralModels: [],
  xkiroModels: [],
  apixoModels: [],
  aihubmixModels: [],
  deepinfraModels: [],
  veniceModels: [],
  ashnaModels: [],
  blazerailModels: [],
  riverModels: [],
  zyloModels: [],
  hyperModels: [],
  customModels: [],
}

describe('FID-2026-1030-005: paperinstruments static catalog', () => {
  test('single model is cataloged with the internal routing prefix', () => {
    expect(Object.values(paperinstrumentsModels)).toEqual([
      'paperinstruments/ultramarine-1-flash',
    ])
  })

  test('cli fetcher serves the model with the deployment window', () => {
    const models = fetchPaperInstrumentsModels()
    expect(models).toHaveLength(1)
    expect(models[0]).toEqual({
      id: 'paperinstruments/ultramarine-1-flash',
      name: 'Ultramarine 1 Flash',
      provider: 'paperinstruments',
      contextLength: 262_144,
    })
  })

  test('fallback table pins the public deployment window, not a guess', () => {
    const pinned = CONTEXT_WINDOW_FALLBACKS.get(
      'paperinstruments/ultramarine-1-flash',
    )
    expect(pinned).toBe(262_144)
    // Guard the two rejected numbers explicitly: the base model's architecture
    // ceiling and the vendor's harness compaction budget.
    expect(pinned).not.toBe(1_048_576)
    expect(pinned).not.toBe(131_072)
  })

  test('registry entry is static, setupAvailable, and keyed by PAPERINSTRUMENTS_API_KEY', () => {
    const entry = PROVIDER_REGISTRY.paperinstruments
    expect(entry.setupAvailable).toBe(true)
    expect(entry.credentials.envVar).toBe('PAPERINSTRUMENTS_API_KEY')
    expect(entry.baseUrl).toBe('https://api.paperinstruments.com/v1')
    expect(entry.protocol).toBe('openai')
    expect(entry.idTransform).toBe('strip')
    expect(entry.catalog.source).toBe('static')
  })

  test('rows reach the assembled /model catalog without a live leg', () => {
    const catalog = assembleGatewayCatalog(emptyLive)
    const row = catalog.find(
      (model) => model.id === 'paperinstruments/ultramarine-1-flash',
    )
    expect(row?.provider).toBe('paperinstruments')
    expect(row?.contextLength).toBe(262_144)
  })
})

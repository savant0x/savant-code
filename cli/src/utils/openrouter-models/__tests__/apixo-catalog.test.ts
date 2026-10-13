/**
 * FID-2026-1013-003 — Apixo (api.apixoai.online) pins.
 *
 * Locks the live-catalog integration:
 * 1. The registry entry is a live, single-protocol, setup-available gateway
 *    on the probed [OI]-compatible base URL, with the operator's credential
 *    name (`APIXOAI_API_KEY`).
 * 2. The dedicated parser maps `context_window`/`max_output_tokens` →
 *    contextLength/maxCompletionTokens — the shared parseChatCatalog reads
 *    `context_length`/`max_completion_tokens` and would extract ZERO windows
 *    (the Vercel mis-parse class, measured 2026-10-13).
 * 3. Every id carries exactly one `apixo/` routing prefix, and `display_name`
 *    supplies the label while `id` alone carries routing.
 * 4. The window-coverage disposition is `runtime-published` (35/35 rows).
 * 5. The exception manifest owns the `live-catalog` kind.
 * 6. The settled ladder resolves the Apixo leg in the Apixo slot — the
 *    positional contract, so a neighbour's catalog can never surface here.
 */
import { WINDOW_COVERAGE_REGISTER } from '@savant-code/common/constants/window-coverage-register'
import { PROVIDER_EXCEPTION_MANIFEST } from '@savant-code/common/providers/provider-exception-manifest'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'
import { describe, expect, test } from 'bun:test'

import { parseApixoModelsForTest } from '../apixo'
import { resolveGatewayLiveCatalogs } from '../gateway-live-results'

import type { OpenRouterModel } from '../types'

/** The measured Apixo `/v1/models` envelope shape (probe 2026-10-13). */
const PROBE_RESPONSE = {
  data: [
    {
      id: 'deepseek-v4.1-flash',
      object: 'model',
      type: 'model',
      created: 1790773175,
      created_at: '2026-09-30T12:59:35.966Z',
      owned_by: 'apixo',
      display_name: 'DeepSeek V4.1 Flash',
      context_window: 1000000,
      max_output_tokens: 65536,
    },
    {
      id: 'claude-sonnet-4-6',
      object: 'model',
      type: 'model',
      created: 1790773175,
      created_at: '2026-09-30T12:59:35.717Z',
      owned_by: 'apixo',
      // Seven roster rows label themselves "the model <version>" while the id
      // keeps the vendor slug — the label is cosmetic, routing reads `id`.
      display_name: 'the model 5',
      context_window: 1000000,
      max_output_tokens: 128000,
    },
    {
      id: 'gemma-4-31b-abliterated',
      object: 'model',
      type: 'model',
      created: 1790773175,
      owned_by: 'apixo',
      display_name: 'Gemma 4 31B Abliterated',
      context_window: 32768,
      max_output_tokens: 8192,
    },
  ],
}

const row = (id: string): OpenRouterModel => ({
  id,
  name: id,
  provider: 'apixo',
})

describe('FID-2026-1013-003: apixo live catalog', () => {
  test('the parser maps context_window/max_output_tokens to the limits', () => {
    const models = parseApixoModelsForTest(PROBE_RESPONSE)
    expect(models).toHaveLength(3)
    const byId = new Map(models.map((model) => [model.id, model]))
    // The shared parser reads context_length/max_completion_tokens — neither
    // key exists on an Apixo row, so it would extract zero windows.
    expect(byId.get('apixo/deepseek-v4.1-flash')?.contextLength).toBe(1000000)
    expect(byId.get('apixo/deepseek-v4.1-flash')?.maxCompletionTokens).toBe(
      65536,
    )
    expect(byId.get('apixo/gemma-4-31b-abliterated')?.contextLength).toBe(32768)
  })

  test('every id carries exactly one apixo/ routing prefix', () => {
    for (const model of parseApixoModelsForTest(PROBE_RESPONSE)) {
      expect(model.id.startsWith('apixo/')).toBe(true)
      expect(model.id.slice('apixo/'.length)).not.toContain('/')
      expect(model.provider).toBe('apixo')
    }
  })

  test('display_name supplies the label; the obfuscated row keeps its slug', () => {
    const models = parseApixoModelsForTest(PROBE_RESPONSE)
    const byId = new Map(models.map((model) => [model.id, model]))
    expect(byId.get('apixo/deepseek-v4.1-flash')?.name).toBe(
      'DeepSeek V4.1 Flash',
    )
    // Routing reads `id`; the "the model 5" label never reaches the wire.
    expect(byId.get('apixo/claude-sonnet-4-6')?.name).toBe('the model 5')
  })

  test('created_at passes through as an ISO string', () => {
    const models = parseApixoModelsForTest(PROBE_RESPONSE)
    const byId = new Map(models.map((model) => [model.id, model]))
    expect(byId.get('apixo/deepseek-v4.1-flash')?.created).toBe(
      '2026-09-30T12:59:35.966Z',
    )
    // The numeric epoch is the fallback when the ISO field is absent.
    expect(byId.get('apixo/gemma-4-31b-abliterated')?.created).toBe(
      new Date(1790773175 * 1000).toISOString(),
    )
  })

  test('a malformed envelope degrades to an empty list, never throws', () => {
    expect(parseApixoModelsForTest({})).toEqual([])
    expect(parseApixoModelsForTest({ data: 'not-an-array' })).toEqual([])
    expect(parseApixoModelsForTest({ data: [null, 42, {}] })).toEqual([])
  })

  test('registry entry is a live single-protocol setup-available gateway', () => {
    const entry = PROVIDER_REGISTRY.apixo
    expect(entry.id).toBe('apixo')
    expect(entry.label).toBe('Apixo')
    expect(entry.kind).toBe('gateway')
    expect(entry.setupAvailable).toBe(true)
    expect(entry.credentials.envVar).toBe('APIXOAI_API_KEY')
    expect(entry.baseUrl).toBe('https://api.apixoai.online/v1')
    expect(entry.protocol).toBe('openai')
    expect(entry.idTransform).toBe('strip')
    expect(entry.catalog).toEqual({
      source: 'live',
      url: 'https://api.apixoai.online/v1/models',
    })
    expect(entry.domain).toBe('apixoai.online')
    expect(entry.order).toBe(4)
  })

  test('window-coverage register declares the runtime-published disposition', () => {
    expect(WINDOW_COVERAGE_REGISTER.get('apixo')?.disposition).toBe(
      'runtime-published',
    )
  })

  test('the exception manifest owns the live-catalog kind', () => {
    const owned = PROVIDER_EXCEPTION_MANIFEST.filter(
      (entry) => entry.providerId === 'apixo',
    )
    expect(owned).toHaveLength(1)
    expect(owned[0].kinds).toEqual(['live-catalog'])
    expect(owned[0].owner).toBe('cli/src/utils/openrouter-models/apixo.ts')
  })

  test('the settled ladder resolves the Apixo leg in the Apixo slot', () => {
    const apixoRow = row('apixo/deepseek-v4.1-flash')
    const neighbourRow = row('xkiro/some-model')
    const fulfilled = (value: OpenRouterModel[]) =>
      ({ status: 'fulfilled', value }) as const
    // The positional contract: nous, kiosapi, apinex, [OI], orcarouter, B.AI,
    // vercel, cleanapis, codecraft, mistral, xkiro, apixo, AIHubMix, custom.
    const restResults = [
      fulfilled([]),
      fulfilled([]),
      fulfilled([]),
      fulfilled([]),
      fulfilled([]),
      fulfilled([]),
      fulfilled([]),
      fulfilled([]),
      fulfilled([]),
      fulfilled([]),
      fulfilled([neighbourRow]),
      fulfilled([apixoRow]),
      fulfilled([]),
      fulfilled([]),
    ]
    const resolved = resolveGatewayLiveCatalogs(
      fulfilled([]),
      fulfilled([]),
      restResults,
    )
    expect(resolved.apixoModels).toEqual([apixoRow])
    // The neighbour slot is unaffected — the shift this pins against.
    expect(resolved.xkiroModels).toEqual([neighbourRow])
    expect(resolved.aihubmixModels).toEqual([])
    expect(resolved.customModels).toEqual([])
  })
})

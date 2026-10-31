import { WINDOW_COVERAGE_REGISTER } from '@savant-code/common/constants/window-coverage-register'
import { PROVIDER_EXCEPTION_MANIFEST } from '@savant-code/common/providers/provider-exception-manifest'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'
import { afterEach, describe, expect, test } from 'bun:test'

import { assembleGatewayCatalog } from '../gateway-catalog-merge'
import { resolveGatewayLiveCatalogs } from '../gateway-live-results'
import {
  __resetHyperCacheForTest,
  fetchHyperModels,
  getCachedHyperModels,
  parseHyperModels,
} from '../hyper'

import type { OpenRouterModel } from '../types'

// Public GET /v1/models shape observed 2026-10-30. Synthetic values keep the
// contract reproducible without account credentials or inference.
const REASONING_ROW = {
  id: 'deepseek-v4.1-flash',
  object: 'model',
  created: 0,
  owned_by: 'hyper',
  display_name: 'DeepSeek V4.1 Flash',
  producer: 'DeepSeek',
  context_window: 1048576,
  max_output_tokens: 262144,
  capabilities: { vision: true },
  reasoning: {
    effort_levels: [
      { value: 'low', display: 'Low' },
      { value: 'high', display: 'High' },
      { value: 'max', display: 'Max' },
    ],
    default_effort_level: 'high',
  },
  pricing: { input: 0.33, output: 1.31, cache_create: 0, cache_hit: 0.03 },
}
const PLAIN_ROW = {
  id: 'gemma-4-26b-a4b-it',
  display_name: 'Gemma 4 26B A4B',
  context_window: 256000,
  max_output_tokens: 25600,
  capabilities: { vision: false },
  pricing: { input: 0.098, output: 0.334 },
}
const response = { object: 'list', data: [REASONING_ROW, PLAIN_ROW] }
const realFetch = globalThis.fetch
const fulfilled = (value: OpenRouterModel[]) =>
  ({ status: 'fulfilled', value }) as const

afterEach(() => {
  globalThis.fetch = realFetch
  __resetHyperCacheForTest()
})

describe('Hyper catalog contract (FID-2026-1030-004)', () => {
  test('registry entry is a keyed OpenAI gateway with a public live catalog', () => {
    expect(PROVIDER_REGISTRY.hyper).toEqual(
      expect.objectContaining({
        id: 'hyper',
        label: 'Hyper',
        kind: 'gateway',
        baseUrl: 'https://hyper.charm.land/v1',
        protocol: 'openai',
        idTransform: 'strip',
        catalog: {
          source: 'live',
          url: 'https://hyper.charm.land/v1/models',
        },
        setupAvailable: true,
        domain: 'charm.land',
        order: 4,
      }),
    )
    expect(PROVIDER_REGISTRY.hyper.credentials.envVar).toBe('HYPER_API_KEY')
  })

  test('maps the measured vendor schema — bare ids, per-million pricing, reasoning', () => {
    const models = parseHyperModels(response)
    expect(models.map((model) => model.id)).toEqual([
      'hyper/deepseek-v4.1-flash',
      'hyper/gemma-4-26b-a4b-it',
    ])
    expect(models[0]).toEqual(
      expect.objectContaining({
        name: 'DeepSeek V4.1 Flash',
        provider: 'hyper',
        contextLength: 1048576,
        maxCompletionTokens: 262144,
        promptPricePerToken: 0.00000033,
        completionPricePerToken: 0.00000131,
        inputCacheReadPricePerToken: 0.00000003,
        capabilities: ['vision', 'reasoning'],
        reasoningEfforts: { levels: ['low', 'high', 'max'], default: 'high' },
      }),
    )
    // No reasoning block and vision: false — no invented capabilities.
    expect(models[1].capabilities).toBeUndefined()
    expect(models[1].reasoningEfforts).toBeUndefined()
  })

  test('malformed envelopes and absent limits never invent metadata', () => {
    for (const malformed of [
      null,
      {},
      { data: 'bad' },
      { data: [null, 42, {}] },
    ]) {
      expect(parseHyperModels(malformed)).toEqual([])
    }
    const [row] = parseHyperModels({
      data: [
        {
          id: 'prism',
          context_window: -1,
          max_output_tokens: 0,
          pricing: { input: '', output: 'bad' },
        },
      ],
    })
    expect(row.name).toBe('prism')
    expect(row.contextLength).toBeUndefined()
    expect(row.maxCompletionTokens).toBeUndefined()
    expect(row.promptPricePerToken).toBeUndefined()
    expect(row.completionPricePerToken).toBeUndefined()
  })

  test('fetch is public, cached, resettable and degrades to its own cache', async () => {
    let calls = 0
    globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        calls++
        expect(String(input)).toBe('https://hyper.charm.land/v1/models')
        expect(new Headers(init?.headers).has('authorization')).toBe(false)
        return calls === 1
          ? Response.json(response)
          : new Response('', { status: 503 })
      },
      { preconnect: realFetch.preconnect },
    )
    const models = await fetchHyperModels()
    expect(models).toHaveLength(2)
    expect(await fetchHyperModels()).toEqual(models)
    expect(calls).toBe(1)
    expect(await fetchHyperModels(true)).toEqual(models)
    expect(getCachedHyperModels()).toEqual(models)
    __resetHyperCacheForTest()
    expect(getCachedHyperModels()).toEqual([])
    expect(await fetchHyperModels()).toEqual([])
  })

  test('slot 19 merges before the custom tail and keeps its own cache on reject', () => {
    const [hyper] = parseHyperModels(response)
    const zylo = { id: 'zylo/text', name: 'Zylo', provider: 'zylo' }
    const custom = { id: 'custom/test', name: 'Custom', provider: 'custom' }
    const rest = Array.from({ length: 21 }, () => fulfilled([]))
    rest[18] = fulfilled([zylo])
    rest[19] = fulfilled([hyper])
    rest[20] = fulfilled([custom])
    const resolved = resolveGatewayLiveCatalogs(
      fulfilled([]),
      fulfilled([]),
      rest,
    )
    expect(resolved.zyloModels).toEqual([zylo])
    expect(resolved.hyperModels).toEqual([hyper])
    expect(resolved.customModels).toEqual([custom])
    expect(assembleGatewayCatalog(resolved)).toContainEqual(hyper)
  })

  test('exception manifest and window coverage agree with the entry', () => {
    const manifest = PROVIDER_EXCEPTION_MANIFEST.find(
      (entry) => entry.providerId === 'hyper',
    )
    expect(manifest).toEqual(
      expect.objectContaining({
        kinds: ['live-catalog'],
        owner: 'cli/src/utils/openrouter-models/hyper.ts',
      }),
    )
    expect(WINDOW_COVERAGE_REGISTER.get('hyper')?.disposition).toBe(
      'runtime-published',
    )
  })
})

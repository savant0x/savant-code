import {
  registerCustomProviders,
  resetCustomProviders,
} from '@savant-code/common/providers/custom-providers'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { fetchGatewayModels } from '../openrouter-models'
import {
  makeJsonResponse,
  registerGatewayCatalogLifecycle,
} from './openrouter-models-test-harness'
import {
  fetchCleanApisModels,
  parseCleanApisModelsForTest,
} from '../openrouter-models/cleanapis'
import {
  fetchCodecraftModels,
  parseCodecraftModelsForTest,
} from '../openrouter-models/codecraft'
import { formatModelInfo } from '../openrouter-models/model-info'
import { parseXkiroModelsForTest } from '../openrouter-models/xkiro'

const compatibleModel = {
  id: 'vendor/gpt-test',
  name: 'GPT Test',
  context_window: 200000,
  created: 1750000000,
  pricing: { input_per_1k: 0.001, output_per_1k: 0.004 },
  architecture: { modality: 'text+image->text', tokenizer: 'Other' },
  top_provider: { context_length: 200000, max_completion_tokens: null },
  capabilities: ['tools', 'vision', 'reasoning'],
}
const xkiroModel = {
  id: 'anthropic/test-model',
  display_name: 'Test Claude',
  modality: 'chat',
  created: 1,
  context_length: 200000,
  max_output_tokens: 32000,
  access_tier: 'premium',
  pricing: {
    currency: 'USD',
    unit: 'per_1m_tokens',
    input: 3,
    output: 15,
    cache_read: 0.3,
  },
  capabilities: { tools: true, vision: false, reasoning: true },
  reasoning_efforts: { levels: ['adaptive', 'disabled'], default: 'adaptive' },
}

describe('requested live catalogs (FID-2026-1003-001)', () => {
  registerGatewayCatalogLifecycle()
  let originalEnv: Record<string, string | undefined>
  const envNames = [
    'CODECRAFT_API_KEY',
    'CLEANAPIS_API_KEY',
    'XKIRO_API_KEY',
  ] as const
  beforeEach(() => {
    originalEnv = Object.fromEntries(
      envNames.map((name) => [name, process.env[name]]),
    )
    for (const name of envNames) process.env[name] = `${name}-dummy`
  })
  afterEach(() => {
    resetCustomProviders()
    for (const name of envNames) {
      if (originalEnv[name] === undefined) delete process.env[name]
      else process.env[name] = originalEnv[name]
    }
  })

  for (const parse of [
    parseCodecraftModelsForTest,
    parseCleanApisModelsForTest,
  ]) {
    test(`${parse.name} normalizes documented prices and numeric creation time`, () => {
      const model = parse({ data: [compatibleModel] })[0]
      expect(model.promptPricePerToken).toBe(0.000001)
      expect(model.completionPricePerToken).toBe(0.000004)
      expect(model.created).toBe('2025-06-15T15:06:40.000Z')
      expect(model.contextLength).toBe(200000)
      expect(model.maxCompletionTokens).toBeUndefined()
      expect(model.topProvider?.maxCompletionTokens).toBeUndefined()
      expect(formatModelInfo(model.id, model)).toContain(
        'tools, vision, reasoning',
      )
    })

    test(`${parse.name} retains old price precedence and exact upstream IDs`, () => {
      const model = parse({
        data: [
          {
            ...compatibleModel,
            id: 'codecraft/route',
            pricing: { prompt: '0', completion: '0.000002', input_per_1k: 5 },
          },
        ],
      })[0]
      expect(model.id.slice(`${model.provider}/`.length)).toBe(
        'codecraft/route',
      )
      expect(model.promptPricePerToken).toBe(0)
      expect(model.completionPricePerToken).toBe(0.000002)
    })

    test(`${parse.name} rejects malformed/negative values without dropping valid IDs`, () => {
      expect(
        parse({
          data: [
            null,
            false,
            { id: 5 },
            {
              id: 'keep',
              context_window: -1,
              created: Number.MAX_VALUE,
              pricing: { prompt: ' ', input_per_1k: -1 },
            },
          ],
        }),
      ).toHaveLength(1)
      const model = parse({
        data: [
          {
            id: 'keep',
            context_window: NaN,
            pricing: { prompt: 'garbage', completion: Infinity },
          },
        ],
      })[0]
      expect(model.contextLength).toBeUndefined()
      expect(model.promptPricePerToken).toBeUndefined()
      expect(model.completionPricePerToken).toBeUndefined()
      expect(parse({ data: {} })).toEqual([])
      expect(parse(null)).toEqual([])
    })
  }

  test('xKiro preserves vendor IDs, limits, USD units and reported access/reasoning metadata', () => {
    const model = parseXkiroModelsForTest({ data: [xkiroModel] })[0]
    expect(model.id).toBe('xkiro/anthropic/test-model')
    expect(model.name).toBe('Test Claude')
    expect(model.contextLength).toBe(200000)
    expect(model.maxCompletionTokens).toBe(32000)
    expect(model.promptPricePerToken).toBe(0.000003)
    expect(model.completionPricePerToken).toBe(0.000015)
    expect(model.inputCacheReadPricePerToken).toBe(0.0000003)
    expect(model.capabilities).toEqual(['tools', 'reasoning'])
    expect(model.created).toBeUndefined()
    expect(formatModelInfo(model.id, model)).toContain(
      'Catalog access tier:** premium',
    )
    expect(formatModelInfo(model.id, model)).toContain('adaptive, disabled')
  })

  test('xKiro filters non-chat rows and keeps missing limits/prices unknown', () => {
    const rows = parseXkiroModelsForTest({
      data: [
        null,
        { id: 'image', modality: 'image' },
        {
          id: 'xkiro/nested/chat',
          modality: 'chat',
          pricing: { currency: 'EUR', unit: 'per_1m_tokens', input: 5 },
        },
      ],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('xkiro/xkiro/nested/chat')
    expect(rows[0].promptPricePerToken).toBeUndefined()
    expect(rows[0].contextLength).toBeUndefined()
    expect(rows[0].maxCompletionTokens).toBeUndefined()
  })

  test('fanout merges all three without moving the custom catalog result', async () => {
    registerCustomProviders([
      {
        id: 'tail-catalog',
        label: 'Tail Catalog',
        baseUrl: 'https://tail.example/v1',
        apiKeyEnvVar: 'TAIL_CATALOG_KEY',
        catalog: {
          source: 'inline',
          models: { 'tail-catalog/last-model': 'Last Model' },
        },
      },
    ])
    const requests: Array<{ url: string; auth: string | null }> = []
    const fetchMock = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        requests.push({
          url,
          auth: new Headers(init?.headers).get('authorization'),
        })
        return makeJsonResponse({
          data: url.includes('xkiro.com') ? [xkiroModel] : [compatibleModel],
        })
      },
    )
    globalThis.fetch = Object.assign(fetchMock, {
      preconnect: globalThis.fetch.preconnect,
    })
    const models = await fetchGatewayModels(true)
    expect(
      models.some((model) => model.id === 'codecraft/vendor/gpt-test'),
    ).toBe(true)
    expect(
      models.some((model) => model.id === 'cleanapis/vendor/gpt-test'),
    ).toBe(true)
    expect(
      models.some((model) => model.id === 'xkiro/anthropic/test-model'),
    ).toBe(true)
    expect(
      models.find((model) => model.id === 'tail-catalog/last-model')?.provider,
    ).toBe('tail-catalog')
    for (const [provider, envVar] of [
      ['codecraftapi.com', 'CODECRAFT_API_KEY'],
      ['cleanapis.com', 'CLEANAPIS_API_KEY'],
      ['api.xkiro.com', 'XKIRO_API_KEY'],
    ]) {
      expect(
        requests.find(
          (request) => request.url === `https://${provider}/v1/models`,
        )?.auth,
      ).toBe(`Bearer ${envVar}-dummy`)
    }
  })

  test('CodeCraft cache survives failed refresh and never crosses CleanAPIs credentials', async () => {
    let failCodecraft = false
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      if (String(input).includes('codecraftapi.com') && failCodecraft)
        return new Response('', { status: 401 })
      return makeJsonResponse({ data: [compatibleModel] })
    })
    globalThis.fetch = Object.assign(fetchMock, {
      preconnect: globalThis.fetch.preconnect,
    })
    const initial = await Promise.all([
      fetchCodecraftModels(true),
      fetchCodecraftModels(true),
    ])
    expect(fetchMock.mock.calls).toHaveLength(1)
    expect(initial[0]).toEqual(initial[1])
    failCodecraft = true
    expect(await fetchCodecraftModels(true)).toEqual(initial[0])
    expect((await fetchCleanApisModels(true))[0].provider).toBe('cleanapis')
    const merged = await fetchGatewayModels(true)
    expect(
      merged.some((model) => model.id === 'codecraft/vendor/gpt-test'),
    ).toBe(true)
    expect(
      merged.some((model) => model.id === 'cleanapis/vendor/gpt-test'),
    ).toBe(true)
  })
})

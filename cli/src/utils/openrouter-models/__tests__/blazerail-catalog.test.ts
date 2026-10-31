import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  __resetBlazerailCacheForTest,
  fetchBlazerailModels,
  getCachedBlazerailModels,
  parseBlazerailModels,
} from '../blazerail'
import { assembleGatewayCatalog } from '../gateway-catalog-merge'
import { resolveGatewayLiveCatalogs } from '../gateway-live-results'

import type { OpenRouterModel } from '../types'

// Public GET /v1/models shape observed 2026-10-17. Synthetic values keep
// the contract reproducible without invoking account authentication/inference.
const CHAT_ROW = {
  id: 'openai/gpt-6-astra:free',
  name: 'GPT-6 Astra Free',
  category: 'general',
  created: 1792286281,
  context_length: 1050000,
  pricing: { prompt: '0', completion: '0' },
  top_provider: { context_length: 1050000, max_completion_tokens: 128000 },
}
const response = { data: [CHAT_ROW] }
const realFetch = globalThis.fetch
const fulfilled = (value: OpenRouterModel[]) =>
  ({ status: 'fulfilled', value }) as const

afterEach(() => {
  globalThis.fetch = realFetch
  __resetBlazerailCacheForTest()
})

describe('BlazeRail catalog contract', () => {
  test('maps the measured schema without conflating free and paid ids', () => {
    const models = parseBlazerailModels({
      data: [
        CHAT_ROW,
        {
          ...CHAT_ROW,
          id: 'openai/gpt-6-astra',
          pricing: { prompt: '0.0000078265' },
        },
      ],
    })
    expect(models).toHaveLength(2)
    const free = models.find((model) => model.id.endsWith(':free'))
    expect(free).toEqual(
      expect.objectContaining({
        id: 'blazerail/openai/gpt-6-astra:free',
        provider: 'blazerail',
        contextLength: 1050000,
        promptPricePerToken: 0,
        completionPricePerToken: 0,
        created: new Date(CHAT_ROW.created * 1000).toISOString(),
        topProvider: expect.objectContaining({ maxCompletionTokens: 128000 }),
      }),
    )
    expect(
      models.find((model) => !model.id.endsWith(':free'))?.promptPricePerToken,
    ).toBe(0.0000078265)
  })

  test('uses category metadata for media plus the existing specialist filter', () => {
    const models = parseBlazerailModels({
      data: [
        CHAT_ROW,
        { id: 'vendor/flux', category: 'image' },
        { id: 'vendor/sora', category: 'video' },
        { id: 'vendor/sonic', category: 'audio' },
        { id: 'vendor/whisper-1', category: null },
        { id: 'vendor/coder:free:nitro', category: 'code' },
        { id: 'vendor/new-chat', category: null },
      ],
    })
    expect(models.map((model) => model.id)).toEqual([
      'blazerail/openai/gpt-6-astra:free',
      'blazerail/vendor/coder:free:nitro',
      'blazerail/vendor/new-chat',
    ])
  })

  test('malformed envelopes and absent limits never invent metadata', () => {
    for (const malformed of [
      null,
      {},
      { data: 'bad' },
      { data: [null, 42, {}] },
    ]) {
      expect(parseBlazerailModels(malformed)).toEqual([])
    }
    const [row] = parseBlazerailModels({
      data: [
        {
          id: 'vendor/coder',
          context_length: -1,
          pricing: { prompt: '', completion: 'bad' },
          top_provider: { max_completion_tokens: null },
        },
      ],
    })
    expect(row.contextLength).toBeUndefined()
    expect(row.topProvider?.maxCompletionTokens).toBeUndefined()
    expect(row.promptPricePerToken).toBeUndefined()
    expect(row.completionPricePerToken).toBeUndefined()
    expect(row.capabilities).toBeUndefined()
  })

  test('fetch is public, cached, resettable and degrades to its own cache', async () => {
    let calls = 0
    globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        calls++
        expect(String(input)).toBe('https://api.blazerail.com/v1/models')
        expect(new Headers(init?.headers).has('authorization')).toBe(false)
        return calls === 1
          ? Response.json(response)
          : new Response('', { status: 503 })
      },
      { preconnect: realFetch.preconnect },
    )
    const models = await fetchBlazerailModels()
    expect(models).toHaveLength(1)
    expect(await fetchBlazerailModels()).toEqual(models)
    expect(calls).toBe(1)
    expect(await fetchBlazerailModels(true)).toEqual(models)
    expect(getCachedBlazerailModels()).toEqual(models)
    __resetBlazerailCacheForTest()
    expect(getCachedBlazerailModels()).toEqual([])
    expect(await fetchBlazerailModels()).toEqual([])
  })

  test('settled ladder and assembler keep BlazeRail between Ashna and custom', () => {
    const [blazerail] = parseBlazerailModels(response)
    const ashna = { id: 'ashna/test', name: 'Ashna', provider: 'ashna' }
    const river = { id: 'river/test', name: 'River', provider: 'river' }
    const custom = { id: 'custom/test', name: 'Custom', provider: 'custom' }
    // FID-2026-1030-004: Hyper joins at slot 19, immediately before the
    // custom-catalogs tail, which stays last at slot 20.
    const rest = Array.from({ length: 21 }, () => fulfilled([]))
    rest[15] = fulfilled([ashna])
    rest[16] = fulfilled([blazerail])
    rest[17] = fulfilled([river])
    rest[20] = fulfilled([custom])
    const resolved = resolveGatewayLiveCatalogs(
      fulfilled([]),
      fulfilled([]),
      rest,
    )
    expect(resolved.ashnaModels).toEqual([ashna])
    expect(resolved.blazerailModels).toEqual([blazerail])
    expect(resolved.riverModels).toEqual([river])
    expect(resolved.customModels).toEqual([custom])
    expect(assembleGatewayCatalog(resolved)).toContainEqual(blazerail)
    expect(assembleGatewayCatalog(resolved)).toContainEqual(river)
    expect(PROVIDER_REGISTRY.blazerail.protocol).toBe('openai')
  })
})

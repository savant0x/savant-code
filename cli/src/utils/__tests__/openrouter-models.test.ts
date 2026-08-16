import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { useGatewayCatalogStore } from '../../state/gateway-catalog-store'
import {
  __resetOpenRouterModelsCacheForTest,
  fetchCommandCodeModels,
  fetchGatewayModels,
  fetchNousModels,
  fetchOpenRouterModels,
  getTokenHarborModels,
  findGatewayModel,
  formatModelInfo,
  getCachedOpenRouterModels,
  hasNousCatalog,
  parseNousModelsForTest,
  hasOpenRouterCatalog,
  resolveContextWindowForModel,
  subscribeGatewayCatalog,
} from '../openrouter-models'
import { applyPersistedProviderApiKeys } from '../provider-setup'

const REAL_FETCH = globalThis.fetch
const makeJsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
let tempConfigDir: string
let originalConfigDirEnv: string | undefined

describe('openrouter-models', () => {
  beforeEach(() => {
    // FID-2026-0815-007: isolate the gateway disk cache to a temp config dir
    // so the write-through never touches the real ~/.savant-code* dir.
    originalConfigDirEnv = process.env.SAVANT_CODE_CONFIG_DIR
    tempConfigDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'savant-gateway-cache-'),
    )
    process.env.SAVANT_CODE_CONFIG_DIR = tempConfigDir
    __resetOpenRouterModelsCacheForTest()
    globalThis.fetch = REAL_FETCH
  })
  afterEach(() => {
    __resetOpenRouterModelsCacheForTest()
    globalThis.fetch = REAL_FETCH
    mock.restore()
    if (originalConfigDirEnv === undefined) {
      delete process.env.SAVANT_CODE_CONFIG_DIR
    } else {
      process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDirEnv
    }
    fs.rmSync(tempConfigDir, { recursive: true, force: true })
  })
  test('parses the live catalog shape (id, name, context, pricing)', async () => {
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(
        makeJsonResponse({
          data: [
            {
              id: 'anthropic/claude-sonnet-4',
              name: 'Anthropic: Claude Sonnet 4',
              description: 'Fast, capable reasoning model.',
              context_length: 200000,
              max_completion_tokens: 8192,
              pricing: { prompt: '0.000003', completion: '0.000015' },
              provider: 'Anthropic',
              modality: 'text+image',
              tokenizer: 'claude',
              instruct_type: 'chat',
              knowledge_cutoff: '2025-10',
              created: '2026-07-15',
            },
            { id: 'openai/gpt-4o', name: 'OpenAI: GPT-4o' },
          ],
        }),
      ),
    )
    const models = await fetchOpenRouterModels(true)
    expect(models).toHaveLength(2)
    expect(models[0].id).toBe('anthropic/claude-sonnet-4')
    expect(models[0].name).toBe('Anthropic: Claude Sonnet 4')
    expect(models[0].description).toBe('Fast, capable reasoning model.')
    expect(models[0].contextLength).toBe(200000)
    expect(models[0].maxCompletionTokens).toBe(8192)
    expect(models[0].promptPricePerToken).toBe(0.000003)
    expect(models[0].completionPricePerToken).toBe(0.000015)
    expect(models[0].provider).toBeUndefined()
    expect(models[0].modality).toBe('text+image')
    expect(models[0].tokenizer).toBe('claude')
    expect(models[0].instructType).toBe('chat')
    expect(models[0].knowledgeCutoff).toBe('2025-10')
    expect(models[0].created).toBe('2026-07-15')
    // Sorted by id
    expect(models[1].id).toBe('openai/gpt-4o')
    expect(hasOpenRouterCatalog()).toBe(true)
    expect(getCachedOpenRouterModels()).toHaveLength(2)
  })
  test('skips entries without an id', async () => {
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(
        makeJsonResponse({ data: [{ name: 'no id' }, { id: 'x/y' }] }),
      ),
    )
    const models = await fetchOpenRouterModels(true)
    expect(models).toHaveLength(1)
    expect(models[0].id).toBe('x/y')
  })
  test('parses Nous ids with one internal prefix and preserves nested ids', () => {
    const models = parseNousModelsForTest({
      data: [
        { id: 'hermes-4-70b', name: 'Hermes 4 70B' },
        { id: 'anthropic/claude-sonnet-4.6' },
        { id: 'nous/already-prefixed' },
        { id: '', name: 'invalid' },
        { id: 42 },
      ],
    })

    expect(models.map((model) => model.id)).toEqual([
      'nous/already-prefixed',
      'nous/anthropic/claude-sonnet-4.6',
      'nous/hermes-4-70b',
    ])
    expect(models.every((model) => model.provider === 'nous')).toBe(true)
  })

  test('degrades to empty list on fetch failure (never throws)', async () => {
    // @ts-expect-error - mock fetch to reject
    globalThis.fetch = mock(() => Promise.reject(new Error('network down')))
    const models = await fetchOpenRouterModels(true)
    expect(models).toEqual([])
  })
  test('degrades to empty list on non-200 response', async () => {
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('err', { status: 500 })),
    )
    const models = await fetchOpenRouterModels(true)
    expect(models).toEqual([])
  })
  test('returns cached catalog without refetching when fresh', async () => {
    let calls = 0
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() => {
      calls++
      return Promise.resolve(
        makeJsonResponse({ data: [{ id: 'a/b' }, { id: 'c/d' }] }),
      )
    })
    await fetchOpenRouterModels(true)
    const firstCalls = calls
    // Within TTL: should not call fetch again.
    const cached = await fetchOpenRouterModels()
    expect(cached.length).toBe(2)
    expect(calls).toBe(firstCalls)
  })
  test('formatModelInfo renders full metadata block', () => {
    const info = formatModelInfo('anthropic/claude-sonnet-4', {
      id: 'anthropic/claude-sonnet-4',
      name: 'Claude Sonnet 4',
      description: 'Fast reasoning model.',
      contextLength: 200000,
      maxCompletionTokens: 8192,
      promptPricePerToken: 0.000003,
      completionPricePerToken: 0.000015,
      provider: 'openrouter',
      modality: 'text+image',
      tokenizer: 'claude',
      instructType: 'chat',
      knowledgeCutoff: '2025-10',
      created: '2026-07-15',
    })
    expect(info).toContain('# Model Information')
    expect(info).toContain('Claude Sonnet 4')
    expect(info).toContain('anthropic/claude-sonnet-4')
    expect(info).toContain('200,000 tokens')
    expect(info).toContain('8,192')
    expect(info).toContain('$3.00 per 1M tokens')
    expect(info).toContain('$15.00 per 1M tokens')
    expect(info).toContain('text+image')
    expect(info).toContain('2025-10')
  })
  test('formatModelInfo falls back gracefully for unknown model', () => {
    const info = formatModelInfo('unknown/model')
    expect(info).toContain('# Model Information')
    expect(info).toContain('unknown/model')
    expect(info).toContain('not found')
  })
  test('builds the static TokenHarbor baseline catalog without network access', () => {
    const models = getTokenHarborModels()

    const expectedModelIds = [
      'tokenharbor/claude-opus-5',
      'tokenharbor/claude-fable-5',
      'tokenharbor/gpt-5.6-sol',
      'tokenharbor/kimi-k3',
      'tokenharbor/qwen3.8-max',
      'tokenharbor/gpt-5.6-terra',
      'tokenharbor/grok-4.5',
      'tokenharbor/claude-sonnet-5',
      'tokenharbor/gemini-3.6-flash',
      'tokenharbor/glm-5.2',
      'tokenharbor/gpt-5.6-luna',
      'tokenharbor/deepseek-v4-flash',
      'tokenharbor/minimax-m3',
      'tokenharbor/deepseek-v4-pro',
      'tokenharbor/mimo-v2.5-pro',
      'tokenharbor/mimo-v2.5',
      'tokenharbor/kimi-k3:free',
      'tokenharbor/deepseek-v4-flash:free',
      'tokenharbor/mimo-v2.5:free',
      'tokenharbor/th-orchestra',
    ]

    expect(models.map((model) => model.id)).toEqual(expectedModelIds)
    expect(models.every((model) => model.provider === 'tokenharbor')).toBe(true)
  })

  test('builds the CommandCode catalog from shared model definitions', () => {
    const models = fetchCommandCodeModels()

    expect(models.length).toBeGreaterThan(0)
    expect(models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'commandcode/deepseek/deepseek-v4-pro',
          provider: 'commandcode',
        }),
        expect.objectContaining({
          id: 'commandcode/claude-sonnet-4.6',
          provider: 'commandcode',
        }),
      ]),
    )
    expect(models.every((model) => model.contextLength !== undefined)).toBe(
      true,
    )
  })

  test('includes Nous models in the combined gateway catalog', async () => {
    const originalNousKey = process.env.NOUS_API_KEY
    process.env.NOUS_API_KEY = 'nous-catalog-test-key'
    try {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(
        (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input)
          if (url.includes('nousresearch.com')) {
            expect(new Headers(init?.headers).get('authorization')).toBe(
              'Bearer nous-catalog-test-key',
            )
            return Promise.resolve(
              makeJsonResponse({ data: [{ id: 'hermes-4-70b' }] }),
            )
          }
          return Promise.resolve(makeJsonResponse({ data: [] }))
        },
      )

      const models = await fetchGatewayModels(true)

      expect(hasNousCatalog()).toBe(true)
      expect(models).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'nous/hermes-4-70b',
            provider: 'nous',
          }),
        ]),
      )
    } finally {
      if (originalNousKey === undefined) delete process.env.NOUS_API_KEY
      else process.env.NOUS_API_KEY = originalNousKey
    }
  })

  test('uses a persisted Nous key for authenticated catalog refresh', async () => {
    const originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    const originalNousKey = process.env.NOUS_API_KEY
    const originalDirectProvider = process.env.DIRECT_PROVIDER
    const originalInferenceBaseUrl = process.env.INFERENCE_BASE_URL
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'savant-nous-catalog-'),
    )
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
    delete process.env.NOUS_API_KEY
    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({ providerApiKeys: { NOUS_API_KEY: 'stored-nous-key' } }),
    )

    try {
      applyPersistedProviderApiKeys()
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(
        (input: RequestInfo | URL, init?: RequestInit) => {
          expect(String(input)).toContain('inference-api.nousresearch.com')
          expect(new Headers(init?.headers).get('authorization')).toBe(
            'Bearer stored-nous-key',
          )
          return Promise.resolve(
            makeJsonResponse({ data: [{ id: 'stored-model' }] }),
          )
        },
      )

      const models = await fetchNousModels(true)
      expect(models.map((model) => model.id)).toEqual(['nous/stored-model'])
    } finally {
      if (originalConfigDir === undefined)
        delete process.env.SAVANT_CODE_CONFIG_DIR
      else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
      if (originalNousKey === undefined) delete process.env.NOUS_API_KEY
      else process.env.NOUS_API_KEY = originalNousKey
      if (originalDirectProvider === undefined)
        delete process.env.DIRECT_PROVIDER
      else process.env.DIRECT_PROVIDER = originalDirectProvider
      if (originalInferenceBaseUrl === undefined)
        delete process.env.INFERENCE_BASE_URL
      else process.env.INFERENCE_BASE_URL = originalInferenceBaseUrl
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test('isolates Nous catalog failure while retaining other gateway models', async () => {
    process.env.NOUS_API_KEY = 'nous-catalog-test-key'
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('nousresearch.com')) {
        return Promise.resolve(new Response('unauthorized', { status: 401 }))
      }
      if (url.includes('openrouter.ai')) {
        return Promise.resolve(
          makeJsonResponse({ data: [{ id: 'openai/kept' }] }),
        )
      }
      return Promise.resolve(makeJsonResponse({ data: [] }))
    })

    const models = await fetchGatewayModels(true)

    expect(hasNousCatalog()).toBe(false)
    expect(models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'openai/kept' }),
        expect.objectContaining({ id: 'tokenharbor/th-orchestra' }),
      ]),
    )
    expect(models.some((model) => model.id.startsWith('nous/'))).toBe(false)
  })

  test('includes TokenHarbor models in the combined gateway catalog', async () => {
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(makeJsonResponse({ data: [] })),
    )

    const models = await fetchGatewayModels(true)

    expect(models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'tokenharbor/th-orchestra',
          provider: 'tokenharbor',
        }),
      ]),
    )
  })

  test('includes CommandCode models in the combined gateway catalog', async () => {
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(makeJsonResponse({ data: [] })),
    )

    const models = await fetchGatewayModels(true)

    expect(models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'commandcode/deepseek/deepseek-v4-pro',
          provider: 'commandcode',
        }),
      ]),
    )
  })

  test('findGatewayModel resolves exact, prefix, and family matches', async () => {
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(
        makeJsonResponse({
          data: [
            { id: 'openai/gpt-5', name: 'GPT-5' },
            { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
          ],
        }),
      ),
    )
    await fetchGatewayModels(true)
    expect(findGatewayModel('openai/gpt-5')?.name).toBe('GPT-5')
    expect(findGatewayModel('gpt-5')).toBeUndefined()
    expect(findGatewayModel('anthropic/claude-sonnet-4.8')?.name).toBe(
      'Claude Sonnet 4',
    )
  })
  test('subscribeGatewayCatalog notifies listeners when the gateway catalog loads', async () => {
    const listener = mock(() => {})
    const unsubscribe = subscribeGatewayCatalog(listener)
    try {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(() =>
        Promise.resolve(makeJsonResponse({ data: [{ id: 'x/y' }] })),
      )
      await fetchGatewayModels(true)
      expect(listener).toHaveBeenCalled()
      expect(listener).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'x/y' })]),
      )
    } finally {
      unsubscribe()
    }
  })
  test('gateway catalog store updates when the gateway catalog loads', async () => {
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(
        makeJsonResponse({ data: [{ id: 'openai/gpt-store-test' }] }),
      ),
    )
    const beforeLoadedAt = useGatewayCatalogStore.getState().lastLoadedAt
    await fetchGatewayModels(true)
    const state = useGatewayCatalogStore.getState()
    expect(state.catalog.some((m) => m.id === 'openai/gpt-store-test')).toBe(
      true,
    )
    expect(state.lastLoadedAt).toBeGreaterThanOrEqual(beforeLoadedAt)
  })
  describe('resolveContextWindowForModel', () => {
    test('returns catalog contextLength when model is in gateway cache', async () => {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(() =>
        Promise.resolve(
          makeJsonResponse({
            data: [
              { id: 'anthropic/claude-sonnet-4', context_length: 200000 },
              { id: 'google/gemini-2.5-pro', context_length: 1048576 },
            ],
          }),
        ),
      )
      await fetchGatewayModels(true)
      expect(resolveContextWindowForModel('anthropic/claude-sonnet-4')).toBe(
        200000,
      )
      expect(resolveContextWindowForModel('google/gemini-2.5-pro')).toBe(
        1048576,
      )
    })
    test('falls back to heuristic when model is not in catalog', async () => {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(() =>
        Promise.resolve(makeJsonResponse({ data: [] })),
      )
      await fetchGatewayModels(true)
      expect(resolveContextWindowForModel('google/gemini-flash')).toBe(1048576)
      expect(resolveContextWindowForModel('deepseek/deepseek-v3')).toBe(131072)
      expect(resolveContextWindowForModel('anthropic/claude-opus-4')).toBe(
        200000,
      )
    })
    test('returns default 200k for unknown models', async () => {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(() =>
        Promise.resolve(makeJsonResponse({ data: [] })),
      )
      await fetchGatewayModels(true)
      expect(resolveContextWindowForModel('unknown/provider-model')).toBe(
        200000,
      )
    })
    test('falls back to heuristic when catalog model has no contextLength', async () => {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(() =>
        Promise.resolve(
          makeJsonResponse({
            data: [{ id: 'openai/custom-model', name: 'Custom Model' }],
          }),
        ),
      )
      await fetchGatewayModels(true)
      // Catalog hit but no contextLength, so falls through to heuristic
      expect(resolveContextWindowForModel('openai/custom-model')).toBe(200000)
    })
  })
})

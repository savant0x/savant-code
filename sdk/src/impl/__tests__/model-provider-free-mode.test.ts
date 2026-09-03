import {
  clearMockedModules,
  mockModule,
} from '@savant-code/common/testing/mock-modules'
import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test'

import type { LanguageModelV2 } from '@ai-sdk/provider'

const REAL_FETCH = globalThis.fetch
const COMMAND_CODE_MODEL = 'commandcode/deepseek/deepseek-v4-pro'
const COMMAND_CODE_CLAUDE_MODEL = 'commandcode/claude-sonnet-4.6'
const TOKEN_HARBOR_MODEL = 'tokenharbor/anthropic/claude-opus-5'
const NOUS_MODEL = 'nous/anthropic/claude-sonnet-4.6'
const COMMAND_CODE_PROMPT = [
  {
    role: 'user' as const,
    content: [{ type: 'text' as const, text: 'test' }],
  },
]

describe('getModelForRequest ChatGPT OAuth fallback behavior', () => {
  const mockGetValidChatGptOAuthCredentials = mock(() => Promise.resolve(null))
  let originalCommandCodeApiKey: string | undefined
  let originalTokenHarborApiKey: string | undefined
  let originalNousApiKey: string | undefined
  let originalOpenRouterApiKey: string | undefined
  let originalOrMasterKey: string | undefined
  let originalInferenceApiKey: string | undefined
  let originalDirectProvider: string | undefined
  let originalInferenceBaseUrl: string | undefined

  beforeEach(async () => {
    originalCommandCodeApiKey = process.env.COMMAND_CODE_API_KEY
    delete process.env.COMMAND_CODE_API_KEY
    originalTokenHarborApiKey = process.env.TOKENHARBOR_API_KEY
    delete process.env.TOKENHARBOR_API_KEY
    originalNousApiKey = process.env.NOUS_API_KEY
    delete process.env.NOUS_API_KEY
    originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY
    originalOrMasterKey = process.env.OR_MASTER_KEY
    originalInferenceApiKey = process.env.INFERENCE_API_KEY
    originalDirectProvider = process.env.DIRECT_PROVIDER
    originalInferenceBaseUrl = process.env.INFERENCE_BASE_URL
    delete process.env.OPENROUTER_API_KEY
    delete process.env.OR_MASTER_KEY
    delete process.env.INFERENCE_API_KEY
    delete process.env.DIRECT_PROVIDER
    delete process.env.INFERENCE_BASE_URL
    const { resetOpenRouterApiKeyCache } =
      await import('../openrouter-key-resolver')
    resetOpenRouterApiKeyCache()
    // Mock CHATGPT_OAUTH_ENABLED to true so the ChatGPT OAuth path is entered.
    // Uses mockModule helper since this is an absolute package specifier.
    await mockModule('@savant-code/common/constants/chatgpt-oauth', () => ({
      CHATGPT_OAUTH_ENABLED: true,
    }))

    // Mock credentials directly with Bun's mock.module — the helper resolves
    // relative paths from common/src/testing/, not from this test file.
    mock.module('../../credentials', () => ({
      getValidChatGptOAuthCredentials: mockGetValidChatGptOAuthCredentials,
    }))

    mockGetValidChatGptOAuthCredentials.mockReset()
    mockGetValidChatGptOAuthCredentials.mockResolvedValue(null)
  })

  afterEach(() => {
    mock.restore()
    globalThis.fetch = REAL_FETCH
    if (originalCommandCodeApiKey === undefined) {
      delete process.env.COMMAND_CODE_API_KEY
    } else {
      process.env.COMMAND_CODE_API_KEY = originalCommandCodeApiKey
    }
    if (originalTokenHarborApiKey === undefined) {
      delete process.env.TOKENHARBOR_API_KEY
    } else {
      process.env.TOKENHARBOR_API_KEY = originalTokenHarborApiKey
    }
    if (originalNousApiKey === undefined) {
      delete process.env.NOUS_API_KEY
    } else {
      process.env.NOUS_API_KEY = originalNousApiKey
    }
    if (originalOpenRouterApiKey === undefined) {
      delete process.env.OPENROUTER_API_KEY
    } else {
      process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey
    }
    if (originalOrMasterKey === undefined) {
      delete process.env.OR_MASTER_KEY
    } else {
      process.env.OR_MASTER_KEY = originalOrMasterKey
    }
    if (originalInferenceApiKey === undefined) {
      delete process.env.INFERENCE_API_KEY
    } else {
      process.env.INFERENCE_API_KEY = originalInferenceApiKey
    }
    if (originalDirectProvider === undefined) {
      delete process.env.DIRECT_PROVIDER
    } else {
      process.env.DIRECT_PROVIDER = originalDirectProvider
    }
    if (originalInferenceBaseUrl === undefined) {
      delete process.env.INFERENCE_BASE_URL
    } else {
      process.env.INFERENCE_BASE_URL = originalInferenceBaseUrl
    }
    clearMockedModules()
  })

  async function importFresh() {
    const mod = await import('../model-provider')
    // Ensure clean rate-limit state
    mod.resetChatGptOAuthRateLimit()
    return mod
  }

  test('falls through to backend when rate-limited', async () => {
    const { getModelForRequest, markChatGptOAuthRateLimited } =
      await importFresh()

    markChatGptOAuthRateLimited()

    const result = await getModelForRequest({
      apiKey: 'test-key',
      model: 'openai/gpt-5.3',
    })

    expect(result.isChatGptOAuth).toBe(false)
  })

  test('falls through to backend when credentials unavailable', async () => {
    const { getModelForRequest } = await importFresh()

    mockGetValidChatGptOAuthCredentials.mockResolvedValue(null)

    const result = await getModelForRequest({
      apiKey: 'test-key',
      model: 'openai/gpt-5.3',
    })

    expect(result.isChatGptOAuth).toBe(false)
  })

  test('requires the TokenHarbor API key', async () => {
    const { getModelForRequest } = await importFresh()

    await expect(
      getModelForRequest({
        apiKey: 'test-key',
        model: 'tokenharbor/th-orchestra',
      }),
    ).rejects.toThrow(
      'TokenHarbor API key not set. Set TOKENHARBOR_API_KEY environment variable or run /provider tokenharbor.',
    )
  })

  test('routes TokenHarbor models with one-prefix normalization', async () => {
    process.env.TOKENHARBOR_API_KEY = 'tokenharbor-test-key'
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response('data: [DONE]\\n\\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      ),
    )
    // @ts-expect-error - test fetch has the same runtime contract
    globalThis.fetch = fetchMock

    const { getModelForRequest } = await importFresh()
    const result = await getModelForRequest({
      apiKey: 'test-key',
      model: TOKEN_HARBOR_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    expect(String(input)).toBe('https://tokenharbor.ai/v1/chat/completions')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer tokenharbor-test-key',
    )
    expect(JSON.parse(String(init?.body)).model).toBe('anthropic/claude-opus-5')
  })

  test('requires the Nous Research API key', async () => {
    const { getModelForRequest } = await importFresh()

    await expect(
      getModelForRequest({ apiKey: 'test-key', model: NOUS_MODEL }),
    ).rejects.toThrow(
      'Nous Research API key not set. Set NOUS_API_KEY environment variable or run /provider nous.',
    )
  })

  test('routes Nous models with stripped nested IDs and no OpenRouter headers', async () => {
    process.env.NOUS_API_KEY = 'nous-test-key'
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response('data: [DONE]\\n\\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      ),
    )
    // @ts-expect-error - test fetch has the same runtime contract
    globalThis.fetch = fetchMock

    const { getModelForRequest } = await importFresh()
    const result = await getModelForRequest({
      apiKey: 'test-key',
      model: NOUS_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    const headers = new Headers(init?.headers)
    expect(String(input)).toBe(
      'https://inference-api.nousresearch.com/v1/chat/completions',
    )
    expect(headers.get('authorization')).toBe('Bearer nous-test-key')
    expect(headers.get('HTTP-Referer')).toBeNull()
    expect(headers.get('X-OpenRouter-Title')).toBeNull()
    const body = JSON.parse(String(init?.body))
    expect(body.model).toBe('anthropic/claude-sonnet-4.6')
    // Nous requires a `user=` tag from raw-key (Bearer) callers — without it
    // the endpoint rejects with 400 "missing tags".
    expect(body.tags).toEqual(['user=savant-code'])
  })

  test('requires the CommandCode API key', async () => {
    const { getModelForRequest } = await importFresh()

    await expect(
      getModelForRequest({ apiKey: 'test-key', model: COMMAND_CODE_MODEL }),
    ).rejects.toThrow(
      'CommandCode API key not set. Set COMMAND_CODE_API_KEY environment variable.',
    )
  })

  test('routes CommandCode OpenAI models to chat completions with the namespaced ID', async () => {
    process.env.COMMAND_CODE_API_KEY = 'commandcode-test-key'
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response('data: [DONE]\\n\\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      ),
    )
    // @ts-expect-error - test fetch has the same runtime contract
    globalThis.fetch = fetchMock

    const { getModelForRequest } = await importFresh()
    const result = await getModelForRequest({
      apiKey: 'test-key',
      model: COMMAND_CODE_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    expect(String(input)).toBe(
      'https://api.commandcode.ai/provider/v1/chat/completions',
    )
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer commandcode-test-key',
    )
    expect(JSON.parse(String(init?.body)).model).toBe(
      'deepseek/deepseek-v4-pro',
    )
  })

  test('routes CommandCode Claude models to Anthropic messages with x-api-key', async () => {
    process.env.COMMAND_CODE_API_KEY = 'commandcode-test-key'
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response('', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      ),
    )
    // @ts-expect-error - test fetch has the same runtime contract
    globalThis.fetch = fetchMock

    const { getModelForRequest } = await importFresh()
    const result = await getModelForRequest({
      apiKey: 'test-key',
      model: COMMAND_CODE_CLAUDE_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    expect(String(input)).toBe(
      'https://api.commandcode.ai/provider/v1/messages',
    )
    expect(new Headers(init?.headers).get('x-api-key')).toBe(
      'commandcode-test-key',
    )
    expect(JSON.parse(String(init?.body)).model).toBe('claude-sonnet-4.6')
  })

  test('requires an OpenRouter key for openrouter/ models (FID-2026-0806-010)', async () => {
    const { getModelForRequest } = await importFresh()

    await expect(
      getModelForRequest({ apiKey: 'test-key', model: 'openrouter/free' }),
    ).rejects.toThrow(
      'OpenRouter API key not set. Set OPENROUTER_API_KEY or OR_MASTER_KEY environment variable.',
    )
  })

  test('routes openrouter/free directly with the full slug unchanged (FID-2026-0806-010)', async () => {
    process.env.OPENROUTER_API_KEY = 'openrouter-test-key'
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response('data: [DONE]\\n\\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      ),
    )
    // @ts-expect-error - test fetch has the same runtime contract
    globalThis.fetch = fetchMock

    const { getModelForRequest } = await importFresh()
    const result = await getModelForRequest({
      apiKey: 'test-key',
      model: 'openrouter/free',
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    expect(String(input)).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer openrouter-test-key',
    )
    // The `openrouter/` prefix is part of the real slug — must NOT be stripped.
    expect(JSON.parse(String(init?.body)).model).toBe('openrouter/free')
  })

  test('bare-slug Nous models require the active Nous key and omit OpenRouter headers', async () => {
    process.env.DIRECT_PROVIDER = 'nous'
    process.env.INFERENCE_BASE_URL = 'https://inference-api.nousresearch.com/v1'
    process.env.OPENROUTER_API_KEY = 'unrelated-openrouter-key'

    const { getModelForRequest } = await importFresh()

    await expect(
      getModelForRequest({
        apiKey: 'caller-stub-key',
        model: 'anthropic/claude-sonnet-4.6',
      }),
    ).rejects.toThrow(
      'Nous Research API key not set. Set NOUS_API_KEY environment variable or run /provider nous.',
    )

    process.env.NOUS_API_KEY = 'nous-bare-slug-key'
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response('data: [DONE]\\n\\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      ),
    )
    // @ts-expect-error - test fetch has the same runtime contract
    globalThis.fetch = fetchMock

    const result = await getModelForRequest({
      apiKey: 'caller-stub-key',
      model: 'anthropic/claude-sonnet-4.6',
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    const headers = new Headers(init?.headers)
    expect(String(input)).toBe(
      'https://inference-api.nousresearch.com/v1/chat/completions',
    )
    expect(headers.get('authorization')).toBe('Bearer nous-bare-slug-key')
    expect(headers.get('HTTP-Referer')).toBeNull()
    expect(headers.get('X-OpenRouter-Title')).toBeNull()
    const body = JSON.parse(String(init?.body))
    expect(body.model).toBe('anthropic/claude-sonnet-4.6')
    // Bare-slug Nous must carry the same required `user=` tag as prefixed
    // `nous/` models (single shared contract).
    expect(body.tags).toEqual(['user=savant-code'])
  })

  test('non-Nous providers omit the required tags body field', async () => {
    process.env.TOKENHARBOR_API_KEY = 'tokenharbor-test-key'
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response('data: [DONE]\n\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      ),
    )
    // @ts-expect-error - test fetch has the same runtime contract
    globalThis.fetch = fetchMock

    const { getModelForRequest } = await importFresh()
    const result = await getModelForRequest({
      apiKey: 'test-key',
      model: TOKEN_HARBOR_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    const body = JSON.parse(String(init?.body))
    // Tags are a Nous-only contract; other providers must not receive them.
    expect(body.tags).toBeUndefined()
  })

  test('bare-slug models use the ACTIVE provider key (FID-2026-0809-001 decision 10)', async () => {
    // Mirrors the CLI runtime: DIRECT_PROVIDER + INFERENCE_BASE_URL are set
    // from the active provider's registry entry at startup.
    process.env.DIRECT_PROVIDER = 'tokenharbor'
    process.env.INFERENCE_BASE_URL = 'https://tokenharbor.ai/v1'
    process.env.TOKENHARBOR_API_KEY = 'tokenharbor-test-key'
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response('data: [DONE]\n\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      ),
    )
    // @ts-expect-error - test fetch has the same runtime contract
    globalThis.fetch = fetchMock

    const { getModelForRequest } = await importFresh()
    const result = await getModelForRequest({
      apiKey: 'caller-stub-key',
      model: 'anthropic/claude-sonnet-4.5',
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    expect(String(input)).toBe('https://tokenharbor.ai/v1/chat/completions')
    // The active provider's own key wins over the caller-supplied stub.
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer tokenharbor-test-key',
    )
  })

  test('bare-slug models fall back to the caller key without an active provider', async () => {
    process.env.INFERENCE_BASE_URL = 'https://example.test/v1'
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response('data: [DONE]\n\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      ),
    )
    // @ts-expect-error - test fetch has the same runtime contract
    globalThis.fetch = fetchMock

    const { getModelForRequest } = await importFresh()
    const result = await getModelForRequest({
      apiKey: 'caller-stub-key',
      model: 'anthropic/claude-sonnet-4.5',
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    expect(String(input)).toBe('https://example.test/v1/chat/completions')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer caller-stub-key',
    )
  })
})

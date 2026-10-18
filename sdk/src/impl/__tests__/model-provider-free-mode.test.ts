// Provider routing and OAuth fallback; shared setup and additional routing
// suites live in sibling model-provider-free-mode files (Loop 325).

import { describe, expect, test, mock } from 'bun:test'

import {
  setupModelProviderTestHarness,
  TOKEN_HARBOR_MODEL,
  ORCAROUTER_MODEL,
  BAI_MODEL,
  VERCEL_MODEL,
  COMMAND_CODE_PROMPT,
} from './model-provider-free-mode-test-setup'

import type { LanguageModelV2 } from '@ai-sdk/provider'

describe('getModelForRequest ChatGPT OAuth fallback behavior', () => {
  const { mockGetValidChatGptOAuthCredentials, importFresh } =
    setupModelProviderTestHarness()

  test('falls through to the direct lane when rate-limited (FID-2026-0929-005: needs INFERENCE_BASE_URL)', async () => {
    const { getModelForRequest, markChatGptOAuthRateLimited } =
      await importFresh()

    markChatGptOAuthRateLimited()
    // No backend fallback exists anymore — the fall-through target is the
    // direct OpenAI-compatible lane, so give it its required base URL.
    process.env.INFERENCE_BASE_URL = 'https://inference.test/v1'
    // The selected custom endpoint owns its credential even for openai/ ids.
    process.env.INFERENCE_API_KEY = 'custom-endpoint-test-key'

    try {
      const result = await getModelForRequest({
        model: 'openai/gpt-5.3',
      })

      expect(result.isChatGptOAuth).toBe(false)
    } finally {
      delete process.env.INFERENCE_BASE_URL
      delete process.env.INFERENCE_API_KEY
    }
  })

  test('falls through to the direct lane when credentials unavailable (FID-2026-0929-005)', async () => {
    const { getModelForRequest } = await importFresh()

    mockGetValidChatGptOAuthCredentials.mockResolvedValue(null)
    process.env.INFERENCE_BASE_URL = 'https://inference.test/v1'
    // The model's vendor prefix cannot borrow the platform provider's key.
    process.env.INFERENCE_API_KEY = 'custom-endpoint-test-key'

    try {
      const result = await getModelForRequest({
        model: 'openai/gpt-5.3',
      })

      expect(result.isChatGptOAuth).toBe(false)
    } finally {
      delete process.env.INFERENCE_BASE_URL
      delete process.env.INFERENCE_API_KEY
    }
  })

  test('requires the TokenHarbor API key', async () => {
    const { getModelForRequest } = await importFresh()

    await expect(
      getModelForRequest({
        model: 'tokenharbor/th-orchestra',
      }),
    ).rejects.toThrow(
      'TokenHarbor API key not set. Set TOKENHARBOR_API_KEY environment variable or run /provider tokenharbor.',
    )
  })

  test('requires a BlazeRail key before constructing an inference request', async () => {
    const { getModelForRequest } = await importFresh()
    const originalKey = process.env.BLAZERAIL_API_KEY
    delete process.env.BLAZERAIL_API_KEY
    try {
      await expect(
        getModelForRequest({ model: 'blazerail/openai/gpt-6-astra:free' }),
      ).rejects.toThrow(
        'BlazeRail API key not set. Set BLAZERAIL_API_KEY environment variable.',
      )
    } finally {
      if (originalKey === undefined) delete process.env.BLAZERAIL_API_KEY
      else process.env.BLAZERAIL_API_KEY = originalKey
    }
  })

  test('BlazeRail sends Bearer auth and preserves namespaces and routing suffixes', async () => {
    const originalKey = process.env.BLAZERAIL_API_KEY
    process.env.BLAZERAIL_API_KEY = 'blazerail-test-key'
    const requests: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ url: String(input), init })
        return new Response('data: [DONE]\n\n', {
          headers: { 'content-type': 'text/event-stream' },
        })
      },
      { preconnect: globalThis.fetch.preconnect },
    )
    try {
      const { getModelForRequest } = await importFresh()
      for (const upstream of [
        'openai/gpt-6-astra',
        'anthropic/claude-sonnet-4.6:free:nitro',
      ]) {
        const result = await getModelForRequest({
          model: `blazerail/${upstream}`,
        })
        await (result.model as LanguageModelV2).doStream({
          prompt: COMMAND_CODE_PROMPT,
        })
        const request = requests.at(-1)
        expect(request?.url).toBe(
          'https://api.blazerail.com/v1/chat/completions',
        )
        expect(new Headers(request?.init?.headers).get('authorization')).toBe(
          'Bearer blazerail-test-key',
        )
        expect(new Headers(request?.init?.headers).has('x-api-key')).toBe(false)
        expect(JSON.parse(String(request?.init?.body)).model).toBe(upstream)
      }
    } finally {
      if (originalKey === undefined) delete process.env.BLAZERAIL_API_KEY
      else process.env.BLAZERAIL_API_KEY = originalKey
    }
  })

  test('requires the River AI API key before constructing an inference request', async () => {
    const { getModelForRequest } = await importFresh()
    const originalKey = process.env.RIVER_AI_API_KEY
    delete process.env.RIVER_AI_API_KEY
    try {
      await expect(
        getModelForRequest({
          model: 'river/deepseek-ai/DeepSeek-V4.1-Flash',
        }),
      ).rejects.toThrow(
        'River AI API key not set. Set RIVER_AI_API_KEY environment variable.',
      )
    } finally {
      if (originalKey === undefined) delete process.env.RIVER_AI_API_KEY
      else process.env.RIVER_AI_API_KEY = originalKey
    }
  })

  test('routes River AI models with Bearer auth and exact upstream IDs', async () => {
    const originalKey = process.env.RIVER_AI_API_KEY
    process.env.RIVER_AI_API_KEY = 'river-test-key'
    const requests: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ url: String(input), init })
        return new Response('data: [DONE]\n\n', {
          headers: { 'content-type': 'text/event-stream' },
        })
      },
      { preconnect: globalThis.fetch.preconnect },
    )
    try {
      const { getModelForRequest } = await importFresh()
      const upstream = 'nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-NVFP4'
      const result = await getModelForRequest({ model: `river/${upstream}` })
      await (result.model as LanguageModelV2).doStream({
        prompt: COMMAND_CODE_PROMPT,
      })

      const request = requests.at(-1)
      expect(request?.url).toBe('https://api.river.ai/v1/chat/completions')
      expect(new Headers(request?.init?.headers).get('authorization')).toBe(
        'Bearer river-test-key',
      )
      expect(new Headers(request?.init?.headers).has('x-api-key')).toBe(false)
      expect(JSON.parse(String(request?.init?.body)).model).toBe(upstream)
    } finally {
      if (originalKey === undefined) delete process.env.RIVER_AI_API_KEY
      else process.env.RIVER_AI_API_KEY = originalKey
    }
  })

  test('Zylo requires its key and routes exact text IDs with Bearer auth', async () => {
    const { getModelForRequest } = await importFresh()
    const originalKey = process.env.ZYLO_API_KEY
    delete process.env.ZYLO_API_KEY
    try {
      await expect(
        getModelForRequest({ model: 'zylo/gemma-4' }),
      ).rejects.toThrow(
        'Zylo AI API key not set. Set ZYLO_API_KEY environment variable.',
      )
      process.env.ZYLO_API_KEY = 'zylo-test-key'
      const requests: Array<{ url: string; init?: RequestInit }> = []
      globalThis.fetch = Object.assign(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          requests.push({ url: String(input), init })
          return new Response('data: [DONE]\n\n', {
            headers: { 'content-type': 'text/event-stream' },
          })
        },
        { preconnect: globalThis.fetch.preconnect },
      )
      const upstream = 'vendor/Exact-Text:variant'
      const result = await getModelForRequest({ model: `zylo/${upstream}` })
      await (result.model as LanguageModelV2).doStream({
        prompt: COMMAND_CODE_PROMPT,
      })
      const request = requests[0]
      expect(request.url).toBe('https://api.zyloai.net/v1/chat/completions')
      expect(new Headers(request.init?.headers).get('authorization')).toBe(
        'Bearer zylo-test-key',
      )
      expect(JSON.parse(String(request.init?.body)).model).toBe(upstream)
    } finally {
      if (originalKey === undefined) delete process.env.ZYLO_API_KEY
      else process.env.ZYLO_API_KEY = originalKey
    }
  })

  test('routes TokenHarbor models with one-prefix normalization', async () => {
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

  test('requires the OrcaRouter API key (FID-2026-0911-002)', async () => {
    const { getModelForRequest } = await importFresh()

    await expect(
      getModelForRequest({
        model: ORCAROUTER_MODEL,
      }),
    ).rejects.toThrow(
      'OrcaRouter API key not set. Set ORCAROUTER_API_KEY environment variable or run /provider orcarouter.',
    )
  })

  test('routes OrcaRouter models with one-prefix normalization (FID-2026-0911-002)', async () => {
    process.env.ORCAROUTER_API_KEY = 'orcarouter-test-key'
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
      model: ORCAROUTER_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    // Base URL + Bearer auth per the OrcaRouter docs contract.
    expect(String(input)).toBe('https://api.orcarouter.ai/v1/chat/completions')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer orcarouter-test-key',
    )
    // `strip` removes only the internal `orcarouter/` routing prefix; the
    // vendor-namespaced remainder goes verbatim (openrouter/apinex shape).
    expect(JSON.parse(String(init?.body)).model).toBe('anthropic/claude-opus-5')
  })

  test('requires the B.AI API key (FID-2026-0911-004)', async () => {
    const { getModelForRequest } = await importFresh()

    await expect(
      getModelForRequest({
        model: BAI_MODEL,
      }),
    ).rejects.toThrow(
      'B.AI API key not set. Set BAI_API_KEY environment variable or run /provider bai.',
    )
  })

  test('routes B.AI models with one-prefix normalization (FID-2026-0911-004)', async () => {
    process.env.BAI_API_KEY = 'bai-test-key'
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
      model: BAI_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    // Base URL + Bearer auth per the B.AI docs contract.
    expect(String(input)).toBe('https://api.b.ai/v1/chat/completions')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer bai-test-key',
    )
    // `strip` removes the internal `bai/` routing prefix; the
    // vendor-namespaced remainder goes verbatim.
    expect(JSON.parse(String(init?.body)).model).toBe(
      'deepseek/deepseek-v4-flash',
    )
  })

  test('requires the Vercel AI Gateway API key (FID-2026-0927-001)', async () => {
    const { getModelForRequest } = await importFresh()

    await expect(
      getModelForRequest({
        model: VERCEL_MODEL,
      }),
    ).rejects.toThrow(
      'Vercel AI Gateway API key not set. Set AI_GATEWAY_API_KEY environment variable or run /provider vercel.',
    )
  })

  test('routes Vercel models with one-prefix normalization (FID-2026-0927-001)', async () => {
    process.env.AI_GATEWAY_API_KEY = 'vercel-test-key'
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
      model: VERCEL_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    // Base URL + Bearer auth per the vercel.com/docs/ai-gateway curl contract.
    expect(String(input)).toBe(
      'https://ai-gateway.vercel.sh/v1/chat/completions',
    )
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer vercel-test-key',
    )
    // `strip` removes only the internal `vercel/` routing prefix; the
    // vendor-namespaced remainder goes verbatim (openrouter/apinex shape).
    expect(JSON.parse(String(init?.body)).model).toBe('alibaba/qwen-3-14b')
  })
})

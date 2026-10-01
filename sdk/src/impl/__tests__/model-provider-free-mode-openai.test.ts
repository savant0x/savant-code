// OpenAI platform provider lane (FID-2026-1001-001) — sibling of the
// free-mode family (shared harness). Two-lane contract: the ChatGPT OAuth
// gate keeps precedence for its allowlisted models; the registry entry
// (api.openai.com, Responses API) serves `openai/<id>` with a platform
// OPENAI_API_KEY; the bare-slug path with OpenAI active constructs the
// Responses model; other active providers keep their byte-identical
// chat-format construction.

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import {
  COMMAND_CODE_PROMPT,
  REAL_FETCH,
  setupModelProviderTestHarness,
} from './model-provider-free-mode-test-setup'

import type { LanguageModelV2 } from '@ai-sdk/provider'

const sseResponse = () =>
  Promise.resolve(
    new Response('data: [DONE]\n\n', {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    }),
  )

describe('model-provider OpenAI platform lane (FID-2026-1001-001)', () => {
  const { importFresh, mockGetValidChatGptOAuthCredentials } =
    setupModelProviderTestHarness()

  beforeEach(() => {
    // Not yet a harness-managed env var (this FID introduces the provider):
    // delete it defensively so .env.local keys cannot leak into the suite.
    delete process.env.OPENAI_API_KEY
  })

  afterEach(() => {
    delete process.env.OPENAI_API_KEY
    globalThis.fetch = REAL_FETCH
  })

  test('requires the OpenAI API key', async () => {
    const { getModelForRequest } = await importFresh()

    await expect(
      getModelForRequest({ model: 'openai/gpt-5.3-codex' }),
    ).rejects.toThrow(
      'OpenAI API key not set. Set OPENAI_API_KEY environment variable or run /provider openai.',
    )
  })

  test('routes openai/<id> to the Responses API with the platform key', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-openai-key'
    const fetchMock = mock(sseResponse)
    // @ts-expect-error - test fetch has the same runtime contract
    globalThis.fetch = fetchMock

    const { getModelForRequest } = await importFresh()
    const result = await getModelForRequest({
      model: 'openai/gpt-5.3-codex',
    })
    expect(result.isChatGptOAuth).toBe(false)
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    expect(fetchMock.mock.calls.length).toBeGreaterThan(0)
    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    // The registry entry speaks the Responses API at the platform root; the
    // idTransform 'strip' removes only the internal `openai/` prefix.
    expect(String(input)).toBe('https://api.openai.com/v1/responses')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer sk-test-openai-key',
    )
    const body = JSON.parse(String(init?.body)) as { model?: string }
    expect(body.model).toBe('gpt-5.3-codex')
  })

  test('the OAuth lane keeps precedence for allowlisted models when credentials exist', async () => {
    // Both lanes armed: the OAuth gate precedes the registry loop, so the
    // platform key must NOT capture the request.
    process.env.OPENAI_API_KEY = 'sk-test-openai-key'
    mockGetValidChatGptOAuthCredentials.mockResolvedValue({
      accessToken: 'oauth-token',
    } as never)

    const { getModelForRequest } = await importFresh()
    const result = await getModelForRequest({
      model: 'openai/gpt-5.3-codex',
    })
    expect(result.isChatGptOAuth).toBe(true)
  })

  test('skipChatGptOAuth forces the platform lane even with credentials', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-openai-key'
    mockGetValidChatGptOAuthCredentials.mockResolvedValue({
      accessToken: 'oauth-token',
    } as never)

    const fetchMock = mock(sseResponse)
    // @ts-expect-error - test fetch has the same runtime contract
    globalThis.fetch = fetchMock

    const { getModelForRequest } = await importFresh()
    const result = await getModelForRequest({
      model: 'openai/gpt-5.3-codex',
      skipChatGptOAuth: true,
    })
    expect(result.isChatGptOAuth).toBe(false)

    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })
    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    expect(String(input)).toBe('https://api.openai.com/v1/responses')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer sk-test-openai-key',
    )
  })

  test('a bare-slug request with OpenAI active constructs the Responses model', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-openai-key'
    process.env.DIRECT_PROVIDER = 'openai'
    process.env.INFERENCE_BASE_URL = 'https://api.openai.com/v1'
    const fetchMock = mock(sseResponse)
    // @ts-expect-error - test fetch has the same runtime contract
    globalThis.fetch = fetchMock

    const { getModelForRequest } = await importFresh()
    const result = await getModelForRequest({ model: 'gpt-5.3-codex' })
    expect(result.isChatGptOAuth).toBe(false)
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    // Step 2b: the bare-slug path dispatches on the active provider's
    // resolved protocol — chat/completions 400s on api.openai.com for
    // reasoning models with tools.
    expect(String(input)).toBe('https://api.openai.com/v1/responses')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer sk-test-openai-key',
    )
    const body = JSON.parse(String(init?.body)) as { model?: string }
    expect(body.model).toBe('gpt-5.3-codex')
  })

  test('a non-OpenAI active provider keeps the chat-format bare-slug construction', async () => {
    process.env.TOKENHARBOR_API_KEY = 'th-test-key'
    process.env.DIRECT_PROVIDER = 'tokenharbor'
    process.env.INFERENCE_BASE_URL = 'https://tokenharbor.ai/v1'
    const fetchMock = mock(sseResponse)
    // @ts-expect-error - test fetch has the same runtime contract
    globalThis.fetch = fetchMock

    const { getModelForRequest } = await importFresh()
    const result = await getModelForRequest({ model: 'some-bare-model' })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    expect(String(input)).toBe('https://tokenharbor.ai/v1/chat/completions')
  })
})

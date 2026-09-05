// model-provider free-mode — ChatGPT OAuth fallback and TokenHarbor
// routing. Parent of the Loop 325 decomposition (CommandCode, Nous, and
// bare-slug suites live in sibling files; shared harness in
// model-provider-free-mode-test-setup).

import { describe, expect, test, mock } from 'bun:test'

import {
  setupModelProviderTestHarness,
  TOKEN_HARBOR_MODEL,
  COMMAND_CODE_PROMPT,
} from './model-provider-free-mode-test-setup'

import type { LanguageModelV2 } from '@ai-sdk/provider'

describe('getModelForRequest ChatGPT OAuth fallback behavior', () => {
  const { mockGetValidChatGptOAuthCredentials, importFresh } =
    setupModelProviderTestHarness()

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
})

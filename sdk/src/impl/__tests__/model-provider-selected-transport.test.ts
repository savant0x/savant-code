import { describe, expect, mock, test } from 'bun:test'

import {
  COMMAND_CODE_PROMPT,
  setupModelProviderTestHarness,
} from './model-provider-free-mode-test-setup'

import type { LanguageModelV2 } from '@ai-sdk/provider'

describe('selected transport cannot be replaced by model text', () => {
  const { importFresh, mockGetValidChatGptOAuthCredentials } =
    setupModelProviderTestHarness()

  test('a registered vendor segment stays in the gateway model id', async () => {
    process.env.DIRECT_PROVIDER = 'nous'
    process.env.INFERENCE_BASE_URL = 'https://inference-api.nousresearch.com/v1'
    process.env.NOUS_API_KEY = 'selected-gateway-test-key'
    const fetchMock = mock((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response('data: [DONE]\n\n', {
          headers: { 'content-type': 'text/event-stream' },
        }),
      ),
    )
    globalThis.fetch = Object.assign(fetchMock, {
      preconnect: globalThis.fetch.preconnect,
    })
    const { getModelForRequest } = await importFresh()
    const result = await getModelForRequest({
      model: 'anthropic/claude-sonnet-4.5',
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })
    const [input, init] = fetchMock.mock.calls[0]!
    expect(String(input)).toBe(
      'https://inference-api.nousresearch.com/v1/chat/completions',
    )
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer selected-gateway-test-key',
    )
    expect(JSON.parse(String(init?.body)).model).toBe(
      'anthropic/claude-sonnet-4.5',
    )
  })

  test('a custom endpoint uses only its own key and does not try OAuth', async () => {
    process.env.DIRECT_PROVIDER = 'openrouter'
    process.env.INFERENCE_BASE_URL = 'https://operator.invalid/v1'
    process.env.INFERENCE_API_KEY = 'operator-endpoint-test-key'
    process.env.OPENROUTER_API_KEY = 'unrelated-provider-test-key'
    const fetchMock = mock((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response('data: [DONE]\n\n', {
          headers: { 'content-type': 'text/event-stream' },
        }),
      ),
    )
    globalThis.fetch = Object.assign(fetchMock, {
      preconnect: globalThis.fetch.preconnect,
    })
    const { getModelForRequest } = await importFresh()
    const result = await getModelForRequest({ model: 'openai/gpt-5' })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })
    const [input, init] = fetchMock.mock.calls[0]!
    expect(String(input)).toBe('https://operator.invalid/v1/chat/completions')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer operator-endpoint-test-key',
    )
    expect(JSON.parse(String(init?.body)).model).toBe('openai/gpt-5')
    expect(mockGetValidChatGptOAuthCredentials).not.toHaveBeenCalled()
  })
})

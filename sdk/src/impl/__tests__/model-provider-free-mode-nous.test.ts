// model-provider free-mode — Nous Research routing (prefixed and bare-slug
// models) and the Nous-only tags contract.
// Sibling of the Loop 325 decomposition (shared harness in
// model-provider-free-mode-test-setup).

import { describe, expect, test, mock } from 'bun:test'

import {
  setupModelProviderTestHarness,
  NOUS_MODEL,
  TOKEN_HARBOR_MODEL,
  COMMAND_CODE_PROMPT,
} from './model-provider-free-mode-test-setup'

import type { LanguageModelV2 } from '@ai-sdk/provider'

describe('getModelForRequest ChatGPT OAuth fallback behavior', () => {
  const { importFresh } = setupModelProviderTestHarness()

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
        new Response('data: [DONE]\n\n', {
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
})

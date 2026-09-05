// model-provider free-mode — OpenCode Zen model routing (chat completions,
// Anthropic messages, Responses API, and native Gemini path).
// Sibling of the Loop 325 decomposition (shared harness in
// model-provider-free-mode-test-setup). FID-2026-0905-003.
// The cyclic tool-schema tests live in
// model-provider-free-mode-cyclic-tools.test.ts (FID-2026-0905-006 split).

import { describe, expect, test, mock } from 'bun:test'

import {
  setupModelProviderTestHarness,
  COMMAND_CODE_PROMPT,
  ZEN_CHAT_MODEL,
  ZEN_CLAUDE_MODEL,
  ZEN_RESPONSES_MODEL,
  ZEN_GEMINI_MODEL,
} from './model-provider-free-mode-test-setup'

import type { LanguageModelV2 } from '@ai-sdk/provider'

describe('getModelForRequest OpenCode Zen routing', () => {
  const { importFresh } = setupModelProviderTestHarness()

  test('requires the OpenCode Zen API key', async () => {
    const { getModelForRequest } = await importFresh()

    await expect(
      getModelForRequest({ apiKey: 'test-key', model: ZEN_CHAT_MODEL }),
    ).rejects.toThrow(
      'OpenCode Zen API key not set. Set OPENCODE_API_KEY environment variable or run /provider opencode-zen.',
    )
  })

  test('routes Zen chat models to chat completions with the stripped ID', async () => {
    process.env.OPENCODE_API_KEY = 'zen-test-key'
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
      model: ZEN_CHAT_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    expect(String(input)).toBe('https://opencode.ai/zen/v1/chat/completions')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer zen-test-key',
    )
    expect(JSON.parse(String(init?.body)).model).toBe('glm-5.3')
  })

  test('routes Zen Claude models to Anthropic messages with x-api-key', async () => {
    process.env.OPENCODE_API_KEY = 'zen-test-key'
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
      model: ZEN_CLAUDE_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    expect(String(input)).toBe('https://opencode.ai/zen/v1/messages')
    expect(new Headers(init?.headers).get('x-api-key')).toBe('zen-test-key')
    expect(JSON.parse(String(init?.body)).model).toBe('claude-sonnet-4-6')
  })

  test('routes Zen Responses models to the responses endpoint', async () => {
    process.env.OPENCODE_API_KEY = 'zen-test-key'
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
      model: ZEN_RESPONSES_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    expect(String(input)).toBe('https://opencode.ai/zen/v1/responses')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer zen-test-key',
    )
    expect(JSON.parse(String(init?.body)).model).toBe('gpt-5.5')
  })

  test('routes Zen Gemini models to the native Gemini path', async () => {
    process.env.OPENCODE_API_KEY = 'zen-test-key'
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
      model: ZEN_GEMINI_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    // Spike outcome (Step 5): the SDK addresses
    // `{baseURL}/models/<id>:streamGenerateContent?alt=sse` for streaming
    // (`:generateContent` for generate); Zen documents the bare
    // `/v1/models/<id>` path. This pins the SDK-built shape; Zen suffix
    // tolerance is proven or denied at live smoke (Step 9, operator key).
    expect(String(input)).toBe(
      'https://opencode.ai/zen/v1/models/gemini-3-flash:streamGenerateContent?alt=sse',
    )
  })

  test('fails closed for Zen models missing from the protocol map', async () => {
    process.env.OPENCODE_API_KEY = 'zen-test-key'
    const { getModelForRequest } = await importFresh()

    await expect(
      getModelForRequest({
        apiKey: 'test-key',
        model: 'opencode-zen/not-a-real-model',
      }),
    ).rejects.toThrow(
      'Unknown protocol for OpenCode Zen model: opencode-zen/not-a-real-model.',
    )
  })
})

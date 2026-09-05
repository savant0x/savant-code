// model-provider free-mode — CommandCode model routing (chat completions
// and Anthropic messages endpoints).
// Sibling of the Loop 325 decomposition (shared harness in
// model-provider-free-mode-test-setup).

import { describe, expect, test, mock } from 'bun:test'

import {
  setupModelProviderTestHarness,
  COMMAND_CODE_MODEL,
  COMMAND_CODE_CLAUDE_MODEL,
  COMMAND_CODE_PROMPT,
} from './model-provider-free-mode-test-setup'

import type { LanguageModelV2 } from '@ai-sdk/provider'

describe('getModelForRequest ChatGPT OAuth fallback behavior', () => {
  const { importFresh } = setupModelProviderTestHarness()

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
})

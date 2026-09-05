// model-provider free-mode — OpenRouter gating and bare-slug model key
// selection (active provider key vs caller key).
// Sibling of the Loop 325 decomposition (shared harness in
// model-provider-free-mode-test-setup).

import { describe, expect, test, mock } from 'bun:test'

import {
  setupModelProviderTestHarness,
  COMMAND_CODE_PROMPT,
} from './model-provider-free-mode-test-setup'

import type { LanguageModelV2 } from '@ai-sdk/provider'

describe('getModelForRequest ChatGPT OAuth fallback behavior', () => {
  const { importFresh } = setupModelProviderTestHarness()

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

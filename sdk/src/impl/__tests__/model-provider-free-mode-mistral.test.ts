// Mistral AI provider lane (FID-2026-1009-005) — sibling of the free-mode
// family (shared harness). api.mistral.ai is an OpenAI-compatible gateway
// with an authenticated live catalog: `mistral/<id>` routes through the
// generic factory with the MISTRAL_API_KEY Bearer header, and a missing key
// throws the registry-templated error.

import { describe, expect, mock, test } from 'bun:test'

import {
  MISTRAL_MODEL,
  COMMAND_CODE_PROMPT,
  setupModelProviderTestHarness,
} from './model-provider-free-mode-test-setup'

import type { LanguageModelV2 } from '@ai-sdk/provider'

describe('model-provider Mistral AI lane (FID-2026-1009-005)', () => {
  const { importFresh } = setupModelProviderTestHarness()

  test('requires the Mistral AI API key', async () => {
    const { getModelForRequest } = await importFresh()

    await expect(
      getModelForRequest({
        model: MISTRAL_MODEL,
      }),
    ).rejects.toThrow(
      'Mistral AI API key not set. Set MISTRAL_API_KEY environment variable or run /provider mistral.',
    )
  })

  test('routes Mistral models with one-prefix normalization', async () => {
    process.env.MISTRAL_API_KEY = 'mistral-test-key'
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
      model: MISTRAL_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    // Base URL + Bearer auth per the api.mistral.ai OpenAI-compatible contract.
    expect(String(input)).toBe('https://api.mistral.ai/v1/chat/completions')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer mistral-test-key',
    )
    // `strip` removes only the internal `mistral/` routing prefix; the
    // bare upstream id goes verbatim.
    expect(JSON.parse(String(init?.body)).model).toBe('codestral-2508')
  })
})

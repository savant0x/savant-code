// Apixo provider lane (FID-2026-1013-003) - sibling of the free-mode family
// (shared harness). api.apixoai.online is an [OI]- and Anthropic-compatible
// gateway with a KEYLESS live catalog: `apixo/<id>` routes through the generic
// factory with the APIXOAI_API_KEY Bearer header, and a missing key throws the
// registry-templated error.

import { describe, expect, mock, test } from 'bun:test'

import {
  APIXO_MODEL,
  COMMAND_CODE_PROMPT,
  setupModelProviderTestHarness,
} from './model-provider-free-mode-test-setup'

import type { LanguageModelV2 } from '@ai-sdk/provider'

describe('model-provider Apixo lane (FID-2026-1013-003)', () => {
  const { importFresh } = setupModelProviderTestHarness()

  test('requires the Apixo API key', async () => {
    const { getModelForRequest } = await importFresh()

    await expect(
      getModelForRequest({
        model: APIXO_MODEL,
      }),
    ).rejects.toThrow(
      'Apixo API key not set. Set APIXOAI_API_KEY environment variable or run /provider apixo.',
    )
  })

  test('routes Apixo models with one-prefix normalization', async () => {
    process.env.APIXOAI_API_KEY = 'apixo-test-key'
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
      model: APIXO_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    // Base URL + Bearer auth per the api.apixoai.online [OI]-compatible
    // contract (apixoai.online/docs).
    expect(String(input)).toBe('https://api.apixoai.online/v1/chat/completions')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer apixo-test-key',
    )
    // `strip` removes only the internal `apixo/` routing prefix; the bare
    // upstream id goes verbatim.
    expect(JSON.parse(String(init?.body)).model).toBe('deepseek-v4.1-flash')
  })
})

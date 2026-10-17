// Ashna provider lane (FID-2026-1016-018) - sibling of the free-mode family
// (shared harness). api.ashna.ai is an OpenAI-compatible gateway with a KEYED
// live catalog: `ashna/<id>` routes through the generic factory with the
// ASHNA_API_KEY Bearer header, and a missing key throws the registry-
// templated error.

import { describe, expect, mock, test } from 'bun:test'

import {
  ASHNA_MODEL,
  COMMAND_CODE_PROMPT,
  setupModelProviderTestHarness,
} from './model-provider-free-mode-test-setup'

import type { LanguageModelV2 } from '@ai-sdk/provider'

describe('model-provider Ashna lane (FID-2026-1016-018)', () => {
  const { importFresh } = setupModelProviderTestHarness()

  test('requires the Ashna API key', async () => {
    const { getModelForRequest } = await importFresh()

    await expect(
      getModelForRequest({
        model: ASHNA_MODEL,
      }),
    ).rejects.toThrow(
      'Ashna API key not set. Set ASHNA_API_KEY environment variable or run /provider ashna.',
    )
  })

  test('routes Ashna models with one-prefix normalization', async () => {
    process.env.ASHNA_API_KEY = 'ashna-test-key'
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
      model: ASHNA_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    // Base URL + Bearer auth per the api.ashna.ai documented contract
    // (ashna.ai/api-docs): /v1/api/chat/completions.
    expect(String(input)).toBe('https://api.ashna.ai/v1/api/chat/completions')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer ashna-test-key',
    )
    // `strip` removes only the internal `ashna/` routing prefix; the bare
    // upstream id goes verbatim.
    expect(JSON.parse(String(init?.body)).model).toBe('gpt-5.5')
  })
})

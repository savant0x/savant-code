// Hyper (Charm) provider lane (FID-2026-1030-004) - sibling of the free-mode
// family (shared harness). hyper.charm.land is an OpenAI-compatible gateway
// with a PUBLIC live catalog: `hyper/<id>` routes through the generic factory
// with the HYPER_API_KEY Bearer header, and a missing key throws the
// registry-templated error. Roster ids are bare, so `strip` sends them
// verbatim after removing the internal routing prefix.

import { describe, expect, mock, test } from 'bun:test'

import {
  COMMAND_CODE_PROMPT,
  setupModelProviderTestHarness,
} from './model-provider-free-mode-test-setup'

import type { LanguageModelV2 } from '@ai-sdk/provider'

const HYPER_MODEL = 'hyper/deepseek-v4.1-flash'

describe('model-provider Hyper lane (FID-2026-1030-004)', () => {
  const { importFresh } = setupModelProviderTestHarness()

  test('requires the Hyper API key', async () => {
    const originalKey = process.env.HYPER_API_KEY
    delete process.env.HYPER_API_KEY
    try {
      const { getModelForRequest } = await importFresh()
      await expect(getModelForRequest({ model: HYPER_MODEL })).rejects.toThrow(
        'Hyper API key not set. Set HYPER_API_KEY environment variable.',
      )
    } finally {
      if (originalKey === undefined) delete process.env.HYPER_API_KEY
      else process.env.HYPER_API_KEY = originalKey
    }
  })

  test('routes Hyper models with Bearer auth and the bare upstream id', async () => {
    process.env.HYPER_API_KEY = 'hyper-test-key'
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
    const result = await getModelForRequest({ model: HYPER_MODEL })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    // Base URL + Bearer auth per https://hyper.charm.land/docs (read 2026-10-30).
    expect(String(input)).toBe('https://hyper.charm.land/v1/chat/completions')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer hyper-test-key',
    )
    // `strip` removes only the internal `hyper/` routing prefix; Hyper's roster
    // ids are bare, so the wire id is the upstream id verbatim.
    expect(JSON.parse(String(init?.body)).model).toBe('deepseek-v4.1-flash')
  })
})

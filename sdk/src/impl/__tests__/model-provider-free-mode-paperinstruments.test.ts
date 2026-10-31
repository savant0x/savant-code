// Paper Instruments (Ultramarine) provider lane (FID-2026-1030-005) - sibling
// of the free-mode family (shared harness). api.paperinstruments.com is an
// OpenAI-compatible gateway: `paperinstruments/<id>` routes through the generic
// factory with the PAPERINSTRUMENTS_API_KEY Bearer header, and a missing key
// throws the registry-templated error. The roster id is bare, so `strip` sends
// it verbatim after removing the internal routing prefix.

import { describe, expect, mock, test } from 'bun:test'

import {
  COMMAND_CODE_PROMPT,
  setupModelProviderTestHarness,
} from './model-provider-free-mode-test-setup'

import type { LanguageModelV2 } from '@ai-sdk/provider'

const PAPER_MODEL = 'paperinstruments/ultramarine-1-flash'

describe('model-provider Paper Instruments lane (FID-2026-1030-005)', () => {
  const { importFresh } = setupModelProviderTestHarness()

  test('requires the Paper Instruments API key', async () => {
    const originalKey = process.env.PAPERINSTRUMENTS_API_KEY
    delete process.env.PAPERINSTRUMENTS_API_KEY
    try {
      const { getModelForRequest } = await importFresh()
      await expect(getModelForRequest({ model: PAPER_MODEL })).rejects.toThrow(
        'Paper Instruments API key not set. Set PAPERINSTRUMENTS_API_KEY environment variable.',
      )
    } finally {
      if (originalKey === undefined) delete process.env.PAPERINSTRUMENTS_API_KEY
      else process.env.PAPERINSTRUMENTS_API_KEY = originalKey
    }
  })

  test('routes Paper Instruments models with Bearer auth and the bare upstream id', async () => {
    process.env.PAPERINSTRUMENTS_API_KEY = 'paper-test-key'
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
    const result = await getModelForRequest({ model: PAPER_MODEL })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    // Base URL + Bearer auth per https://docs.paperinstruments.com/docs/ultramarine
    // (read 2026-10-30).
    expect(String(input)).toBe(
      'https://api.paperinstruments.com/v1/chat/completions',
    )
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer paper-test-key',
    )
    // `strip` removes only the internal `paperinstruments/` routing prefix; the
    // vendor's roster id is bare, so the wire id is the upstream id verbatim.
    expect(JSON.parse(String(init?.body)).model).toBe('ultramarine-1-flash')
  })
})

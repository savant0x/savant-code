// model-provider free-mode — OpenCode Go shared-credential routing.
// Proves the FID-2026-0905-003 key merge: one OPENCODE_API_KEY powers Go,
// with the legacy OPENCODE_GO_API_KEY honored as a fallback.
// Sibling of the Loop 325 decomposition (shared harness in
// model-provider-free-mode-test-setup).

import { describe, expect, test, mock } from 'bun:test'

import {
  setupModelProviderTestHarness,
  COMMAND_CODE_PROMPT,
} from './model-provider-free-mode-test-setup'

import type { LanguageModelV2 } from '@ai-sdk/provider'

const GO_MODEL = 'opencode-go/glm-5.2'

describe('getModelForRequest OpenCode Go shared credential', () => {
  const { importFresh } = setupModelProviderTestHarness()

  test('routes Go models with only the shared OPENCODE_API_KEY set', async () => {
    process.env.OPENCODE_API_KEY = 'shared-key'
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
      model: GO_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    expect(String(input)).toBe('https://opencode.ai/zen/go/v1/chat/completions')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer shared-key',
    )
    expect(JSON.parse(String(init?.body)).model).toBe('glm-5.2')
  })

  test('honors the legacy OPENCODE_GO_API_KEY fallback', async () => {
    process.env.OPENCODE_GO_API_KEY = 'legacy-key'
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
      model: GO_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer legacy-key',
    )
  })
})

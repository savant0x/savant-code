// model-provider custom providers (FID-2026-0910-004 Step 4) — prefixed
// custom models route via the effective registry, and an active custom
// provider authorizes bare-slug models with its own key (fail-closed when
// the key is absent). Sibling of the free-mode family (shared harness).

import {
  getEffectiveProviderRegistry,
  registerCustomProviders,
  resetCustomProviders,
} from '@savant-code/common/providers/custom-providers'
import { afterEach, describe, expect, mock, test } from 'bun:test'

import {
  REAL_FETCH,
  setupModelProviderTestHarness,
} from './model-provider-free-mode-test-setup'

import type { LanguageModelV2 } from '@ai-sdk/provider'
import type { CustomProviderConfig } from '@savant-code/common/providers/types'

const CUSTOM: CustomProviderConfig = {
  id: 'my-gateway',
  label: 'My Gateway',
  baseUrl: 'https://gw.example.com/v1',
  apiKeyEnvVar: 'MY_GW_KEY',
  catalog: { source: 'none' },
}

const PROMPT = [
  { role: 'user' as const, content: [{ type: 'text' as const, text: 'test' }] },
]

describe('model-provider custom providers (FID-2026-0910-004 Step 4)', () => {
  const { importFresh } = setupModelProviderTestHarness()

  afterEach(() => {
    resetCustomProviders()
    delete process.env.MY_GW_KEY
    globalThis.fetch = REAL_FETCH
  })

  test('routes a prefixed custom model through the effective registry', async () => {
    process.env.MY_GW_KEY = 'gw-test-key'
    registerCustomProviders([CUSTOM])
    // The merged view must carry the custom entry for the SDK loop.
    expect(getEffectiveProviderRegistry()['my-gateway']).toBeDefined()

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
      apiKey: 'caller-key',
      model: 'my-gateway/model-x',
    })
    await (result.model as LanguageModelV2).doStream({ prompt: PROMPT })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    // Routed to the CUSTOM base URL (not the default endpoint) with the
    // custom provider's own credential.
    expect(String(input)).toBe('https://gw.example.com/v1/chat/completions')
    const headers = new Headers(init?.headers)
    expect(headers.get('authorization')).toBe('Bearer gw-test-key')
  })

  test('an active custom gateway fails closed on bare slugs without its key', async () => {
    // Old behavior (built-in registry lookup): 'my-gateway' is unknown, so
    // the bare-slug path silently used the caller key. Effective-registry
    // lookup makes the active custom gateway fail closed like built-ins.
    process.env.DIRECT_PROVIDER = 'my-gateway'
    registerCustomProviders([CUSTOM])

    const { getModelForRequest } = await importFresh()
    await expect(
      getModelForRequest({ apiKey: 'caller-key', model: 'some-bare-model' }),
    ).rejects.toThrow('MY_GW_KEY')
  })

  test('an active custom gateway authorizes bare slugs with its own key', async () => {
    process.env.DIRECT_PROVIDER = 'my-gateway'
    process.env.MY_GW_KEY = 'gw-test-key'
    process.env.INFERENCE_BASE_URL = 'https://gw.example.com/v1'
    registerCustomProviders([CUSTOM])

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
      apiKey: 'caller-key',
      model: 'some-bare-model',
    })
    await (result.model as LanguageModelV2).doStream({ prompt: PROMPT })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    expect(String(input)).toBe('https://gw.example.com/v1/chat/completions')
    const headers = new Headers(init?.headers)
    // The ACTIVE provider's own key is authoritative (decision 10), not the
    // caller-supplied fallback.
    expect(headers.get('authorization')).toBe('Bearer gw-test-key')
  })
})

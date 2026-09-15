// Gateway routing pins (FID-2026-0914-001) — split from
// model-provider-free-mode.test.ts (300-line cap discipline). Same shape
// for every gateway: key-missing fails closed with the templated message;
// key-present routes through the generic factory with the internal prefix
// stripped. hcnsec + tokenbom legs moved verbatim from the parent file;
// infron + unorouter legs are new.

import { describe, expect, test, mock } from 'bun:test'

import {
  setupModelProviderTestHarness,
  INFRON_MODEL,
  UNOROUTER_MODEL,
  HCNSEC_MODEL,
  TOKENBOM_MODEL,
  COMMAND_CODE_PROMPT,
} from './model-provider-free-mode-test-setup'

import type { LanguageModelV2 } from '@ai-sdk/provider'

describe('getModelForRequest gateway routing (FID-2026-0914-001)', () => {
  const { importFresh } = setupModelProviderTestHarness()

  test('requires the Infron API key', async () => {
    const { getModelForRequest } = await importFresh()

    await expect(
      getModelForRequest({
        apiKey: 'test-key',
        model: INFRON_MODEL,
      }),
    ).rejects.toThrow(
      'Infron API key not set. Set INFRON_API_KEY environment variable or run /provider infron.',
    )
  })

  test('routes Infron models with one-prefix normalization', async () => {
    process.env.INFRON_API_KEY = 'infron-test-key'
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
      model: INFRON_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    // Docs quickstart pins the inference host llm.onerouter.pro/v1.
    expect(String(input)).toBe('https://llm.onerouter.pro/v1/chat/completions')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer infron-test-key',
    )
    // `strip` removes the internal `infron/` routing prefix; the
    // vendor-namespaced remainder goes verbatim (openrouter/apinex shape).
    expect(JSON.parse(String(init?.body)).model).toBe(
      'deepseek/deepseek-v4-flash:free',
    )
  })

  test('requires the UnoRouter API key', async () => {
    const { getModelForRequest } = await importFresh()

    await expect(
      getModelForRequest({
        apiKey: 'test-key',
        model: UNOROUTER_MODEL,
      }),
    ).rejects.toThrow(
      'UnoRouter API key not set. Set UNOROUTER_API_KEY environment variable or run /provider unorouter.',
    )
  })

  test('routes UnoRouter models with one-prefix normalization', async () => {
    process.env.UNOROUTER_API_KEY = 'unorouter-test-key'
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
      model: UNOROUTER_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    // Docs quickstart: BASE_URL = https://api.unorouter.com/v1.
    expect(String(input)).toBe('https://api.unorouter.com/v1/chat/completions')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer unorouter-test-key',
    )
    // `strip` removes the internal `unorouter/` routing prefix; the bare
    // upstream slug (incl. the `:free` suffix) goes verbatim.
    expect(JSON.parse(String(init?.body)).model).toBe('glm-5.3-flash:free')
  })

  test('requires the HCNSec API key (FID-2026-0913-001)', async () => {
    const { getModelForRequest } = await importFresh()

    await expect(
      getModelForRequest({
        apiKey: 'test-key',
        model: HCNSEC_MODEL,
      }),
    ).rejects.toThrow(
      'HCNSec API key not set. Set HCNSEC_API_KEY environment variable or run /provider hcnsec.',
    )
  })

  test('routes HCNSec models with one-prefix normalization (FID-2026-0913-001)', async () => {
    process.env.HCNSEC_API_KEY = 'hcnsec-test-key'
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
      model: HCNSEC_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    // Base URL + Bearer auth per the audited gateway contract.
    expect(String(input)).toBe('https://api.hcnsec.cn/v1/chat/completions')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer hcnsec-test-key',
    )
    // `strip` removes the internal `hcnsec/` routing prefix; the upstream
    // id goes verbatim (case-exact as served).
    expect(JSON.parse(String(init?.body)).model).toBe('glm-5.3-flash')
  })

  test('requires the TokenBom API key (FID-2026-0913-001)', async () => {
    const { getModelForRequest } = await importFresh()

    await expect(
      getModelForRequest({
        apiKey: 'test-key',
        model: TOKENBOM_MODEL,
      }),
    ).rejects.toThrow(
      'TokenBom API key not set. Set TOKENBOM_API_KEY environment variable or run /provider tokenbom.',
    )
  })

  test('routes TokenBom models with one-prefix normalization (FID-2026-0913-001)', async () => {
    process.env.TOKENBOM_API_KEY = 'tokenbom-test-key'
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
      model: TOKENBOM_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    // Same host serves site + API (audited live); Bearer sk-sub- key.
    expect(String(input)).toBe('https://tokenbom.com/v1/chat/completions')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer tokenbom-test-key',
    )
    expect(JSON.parse(String(init?.body)).model).toBe('gpt-5.5')
  })
})

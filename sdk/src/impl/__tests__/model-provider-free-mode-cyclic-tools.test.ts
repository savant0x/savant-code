// model-provider free-mode — cyclic tool-schema cutting across every per-model
// wire protocol path (chat completions, Anthropic messages, Responses API,
// native Gemini). Originally driven through OpenCode Zen models; re-pointed to
// TokenRouter's per-model protocol map (FID-2026-0916-004) after the zen
// provider removal — same four protocol surfaces, same regression coverage.
// Split from model-provider-free-mode-opencode-zen.test.ts (FID-2026-0905-006
// ceiling split); shared harness in model-provider-free-mode-test-setup.
// FID-2026-0905-004.

import { describe, expect, test, mock } from 'bun:test'

import {
  setupModelProviderTestHarness,
  COMMAND_CODE_PROMPT,
} from './model-provider-free-mode-test-setup'

import type { LanguageModelV2 } from '@ai-sdk/provider'

/** TokenRouter ids exercising each per-model wire protocol. */
const TR_RESPONSES_MODEL = 'tokenrouter/openai/gpt-5.5'
const TR_ANTHROPIC_MODEL = 'tokenrouter/anthropic/claude-sonnet-5'
const TR_GEMINI_MODEL = 'tokenrouter/google/gemini-3.1-pro-preview'
const TR_CHAT_MODEL = 'tokenrouter/deepseek/deepseek-v4-pro'

/**
 * Genuinely recursive tool schema, mirroring the real `set_output`
 * serialization (free-form-JSON `$defs` self-cycle). FID-2026-0905-004.
 */
const CYCLIC_TOOL = {
  type: 'function' as const,
  name: 'set_output',
  description: 'test',
  inputSchema: {
    type: 'object',
    properties: { output: { $ref: '#/$defs/__schema0' } },
    $defs: {
      __schema0: {
        anyOf: [
          { type: 'string' },
          {
            type: 'object',
            additionalProperties: { $ref: '#/$defs/__schema0' },
          },
          { type: 'array', items: { $ref: '#/$defs/__schema0' } },
        ],
      },
    },
  },
} as unknown as Extract<
  Parameters<LanguageModelV2['doStream']>[0]['tools'],
  Array<unknown>
>[number]

/** True when a value contains no `$ref`/`$defs`/`definitions` keys. */
function hasNoRef(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(hasNoRef)
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.$ref === 'string') return false
    if ('$defs' in record || 'definitions' in record) return false
    return Object.values(record).every(hasNoRef)
  }
  return true
}

describe('getModelForRequest cyclic tool schemas across wire protocols', () => {
  const { importFresh } = setupModelProviderTestHarness()

  test('cuts cyclic tool schemas on the responses path (FID-2026-0905-004)', async () => {
    process.env.TOKENROUTER_API_KEY = 'tr-test-key'
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
      model: TR_RESPONSES_MODEL,
    })
    // doStream returns PromiseLike (no .catch) — lift to Promise.
    await Promise.resolve(
      (result.model as LanguageModelV2).doStream({
        prompt: COMMAND_CODE_PROMPT,
        tools: [CYCLIC_TOOL],
      }),
    ).catch(() => {
      // DONE-only mock streams may fail SDK response parsing; the
      // request was already sent — assertions below are the payload.
    })

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    const body = JSON.parse(String(init?.body)) as {
      tools?: Array<{ function?: { parameters?: unknown } }>
    }
    expect(body.tools).toHaveLength(1)
    expect(hasNoRef(body.tools?.[0]?.function?.parameters)).toBe(true)
  })

  test('cuts cyclic tool schemas on the Anthropic path (FID-2026-0905-004)', async () => {
    process.env.TOKENROUTER_API_KEY = 'tr-test-key'
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
      model: TR_ANTHROPIC_MODEL,
    })
    // doStream returns PromiseLike (no .catch) — lift to Promise.
    await Promise.resolve(
      (result.model as LanguageModelV2).doStream({
        prompt: COMMAND_CODE_PROMPT,
        tools: [CYCLIC_TOOL],
      }),
    ).catch(() => {
      // See above — request assertions are the payload.
    })

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    const body = JSON.parse(String(init?.body)) as {
      tools?: Array<{ input_schema?: unknown }>
    }
    expect(body.tools).toHaveLength(1)
    expect(hasNoRef(body.tools?.[0]?.input_schema)).toBe(true)
  })

  test('cuts cyclic tool schemas on the Gemini path (FID-2026-0905-004)', async () => {
    process.env.TOKENROUTER_API_KEY = 'tr-test-key'
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
      model: TR_GEMINI_MODEL,
    })
    // doStream returns PromiseLike (no .catch) — lift to Promise.
    await Promise.resolve(
      (result.model as LanguageModelV2).doStream({
        prompt: COMMAND_CODE_PROMPT,
        tools: [CYCLIC_TOOL],
      }),
    ).catch(() => {
      // See above — request assertions are the payload.
    })

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    const body = JSON.parse(String(init?.body)) as {
      tools?: Array<{ functionDeclarations?: Array<{ parameters?: unknown }> }>
    }
    expect(body.tools?.[0]?.functionDeclarations).toHaveLength(1)
    expect(
      hasNoRef(body.tools?.[0]?.functionDeclarations?.[0]?.parameters),
    ).toBe(true)
  })

  test('chat path already cuts cyclic tools identically (parity)', async () => {
    process.env.TOKENROUTER_API_KEY = 'tr-test-key'
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
      model: TR_CHAT_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
      tools: [CYCLIC_TOOL],
    })

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    const body = JSON.parse(String(init?.body)) as {
      tools?: Array<{ function?: { parameters?: unknown } }>
    }
    expect(body.tools).toHaveLength(1)
    expect(hasNoRef(body.tools?.[0]?.function?.parameters)).toBe(true)
  })
})

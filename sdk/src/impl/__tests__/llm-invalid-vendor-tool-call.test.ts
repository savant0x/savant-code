// FID-2026-0912-005 Step 1 (RED pin test) — vendor-path invalid tool-inputs
// must be classified as `native-incomplete` error chunks at the SDK boundary
// so the runtime's steering/strike/experience-capture machinery applies
// uniformly across provider families.
//
// Ground truth (pinned ai@5.0.122): when a vendor SDK (e.g. @ai-sdk/anthropic)
// emits a tool-call part whose arguments JSON fails to parse, `ai` core marks
// it `invalid: true` (ai/dist/index.mjs:1894-1907) and filters it from
// execution (ai/dist/index.mjs:2378-2401). promptAiSdkStream's `tool-call`
// branch must NOT forward that raw part into the runtime (today it degrades
// to a generic stringInputError there, bypassing classification).

import {
  clearMockedModules,
  mockModule,
} from '@savant-code/common/testing/mock-modules'
import { InvalidToolInputError, NoSuchToolError } from 'ai'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

const REAL_FETCH = globalThis.fetch

/** Invalid tool-call part shape per ai@5.0.122 `TypedToolCall` (DynamicToolCall branch). */
type Part = {
  type: 'tool-call'
  toolCallId: string
  toolName: string
  input: unknown
  dynamic?: boolean
  invalid?: boolean
  error?: unknown
}

function createFakeStreamResult(parts: Part[]) {
  return {
    fullStream: (async function* () {
      for (const part of parts) {
        yield part
      }
    })(),
    response: Promise.resolve({ id: 'resp-1' }),
    request: Promise.resolve({ body: {} }),
    usage: Promise.resolve({
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
    }),
    providerMetadata: Promise.resolve({}),
  }
}

async function collectChunks(parts: Part[]): Promise<{
  collected: unknown[]
  streamError: unknown
}> {
  const { promptAiSdkStream } = await import('../llm')

  const gen = promptAiSdkStream({
    runId: 'run-1',
    clientSessionId: 'client-1',
    fingerprintId: 'fp-1',
    model: 'openai/gpt-5.3',
    userId: 'user-1',
    userInputId: 'input-1',
    sendAction: async () => {},
    trackEvent: async () => {},
    logger: {
      debug: mock(() => {}),
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
    },
    signal: new AbortController().signal,
    messages: [{ role: 'user', content: 'hi' }],
  } as unknown as Parameters<typeof promptAiSdkStream>[0])

  const collected: unknown[] = []
  let streamError: unknown = null
  try {
    for await (const chunk of gen) {
      collected.push(chunk)
    }
  } catch (error) {
    streamError = error
  }
  return { collected, streamError }
}

describe('FID-2026-0912-005: invalid vendor tool-call classification', () => {
  let originalInferenceKey: string | undefined
  const getValidChatGptOAuthCredentialsMock = mock<
    () => Promise<{ accessToken: string } | null>
  >(() => Promise.resolve(null))

  beforeEach(async () => {
    originalInferenceKey = process.env.INFERENCE_API_KEY
    process.env.INFERENCE_API_KEY = 'tool-classification-endpoint-test-key'
    // FID-2026-0929-005: no backend fallback exists, so the direct lane must
    // fully resolve — give the test an inference base URL.
    process.env.INFERENCE_BASE_URL = 'https://inference.test/v1'
    // Non-OAuth path: no special error classification, no fallback re-streams.
    await mockModule('@savant-code/common/constants/chatgpt-oauth', () => ({
      CHATGPT_OAUTH_ENABLED: false,
    }))
    mock.module('../../credentials', () => ({
      getValidChatGptOAuthCredentials: getValidChatGptOAuthCredentialsMock,
      refreshChatGptOAuthToken: mock(() => Promise.resolve(false)),
    }))
  })

  afterEach(() => {
    mock.restore()
    globalThis.fetch = REAL_FETCH
    clearMockedModules()
    delete process.env.INFERENCE_BASE_URL
    if (originalInferenceKey === undefined) delete process.env.INFERENCE_API_KEY
    else process.env.INFERENCE_API_KEY = originalInferenceKey
  })

  test('classifies an invalid (truncated-args) tool-call as native-incomplete', async () => {
    const truncatedArgsPart: Part = {
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'read_files',
      // Vendor emitted arguments JSON cut mid-object — ai core parsed/failed
      // it and marked the part invalid. The exact raw payload shape varies by
      // vendor; the invalid marker is what ai core guarantees.
      input: undefined,
      dynamic: true,
      invalid: true,
      error: new InvalidToolInputError({
        toolName: 'read_files',
        toolInput: '{"paths":["a.ts"',
        cause: new Error('Unexpected end of JSON input'),
      }),
    }
    const streamTextMock = mock(() =>
      createFakeStreamResult([truncatedArgsPart]),
    )
    await mockModule('ai', () => ({
      streamText: streamTextMock,
    }))

    const { collected, streamError } = await collectChunks([truncatedArgsPart])

    expect(streamError).toBeNull()

    // (a) classified error chunk is yielded…
    const nativeError = collected.find(
      (c) =>
        typeof c === 'object' &&
        c !== null &&
        (c as { errorClass?: string }).errorClass === 'native-incomplete',
    ) as
      | {
          type: string
          errorClass: string
          toolName?: string
          message?: string
        }
      | undefined
    expect(nativeError).toBeDefined()
    expect(nativeError?.type).toBe('error')
    expect(nativeError?.toolName).toBe('read_files')
    expect(nativeError?.message).toContain('Incomplete arguments')

    // …and (b) the raw invalid tool-call part is NOT forwarded.
    const forwardedToolCalls = collected.filter(
      (c) =>
        typeof c === 'object' &&
        c !== null &&
        (c as { type?: string }).type === 'tool-call',
    )
    expect(forwardedToolCalls).toHaveLength(0)
  })

  // FID-2026-1012-002: an undeclared tool name is NOT an argument problem. This
  // case used to be classified `native-incomplete` ("Incomplete arguments for
  // tool mystery_tool"), which told the model to shrink a payload that was
  // never the problem and spent the truncation ladder's strikes on a retry no
  // wording can satisfy. It is now its own class.
  test('classifies an invalid NoSuchToolError tool-call as tool-unavailable', async () => {
    const unknownToolPart: Part = {
      type: 'tool-call',
      toolCallId: 'call-2',
      toolName: 'mystery_tool',
      input: undefined,
      dynamic: true,
      invalid: true,
      error: new NoSuchToolError({ toolName: 'mystery_tool' }),
    }
    const streamTextMock = mock(() => createFakeStreamResult([unknownToolPart]))
    await mockModule('ai', () => ({
      streamText: streamTextMock,
    }))

    const { collected, streamError } = await collectChunks([unknownToolPart])

    expect(streamError).toBeNull()
    const unavailableError = collected.find(
      (c) =>
        typeof c === 'object' &&
        c !== null &&
        (c as { errorClass?: string }).errorClass === 'tool-unavailable',
    ) as { toolName?: string; message?: string } | undefined
    expect(unavailableError).toBeDefined()
    expect(unavailableError?.toolName).toBe('mystery_tool')
    expect(unavailableError?.message).toContain(
      'is not available to this agent',
    )
    // The truncation class must not be claimed for a name that was never
    // offered: that wording is what sent the model into an unsatisfiable retry.
    expect(
      collected.some(
        (c) =>
          typeof c === 'object' &&
          c !== null &&
          (c as { errorClass?: string }).errorClass === 'native-incomplete',
      ),
    ).toBe(false)

    const forwardedToolCalls = collected.filter(
      (c) =>
        typeof c === 'object' &&
        c !== null &&
        (c as { type?: string }).type === 'tool-call',
    )
    expect(forwardedToolCalls).toHaveLength(0)
  })

  test('still forwards valid tool-call parts untouched', async () => {
    const validPart: Part = {
      type: 'tool-call',
      toolCallId: 'call-3',
      toolName: 'read_files',
      input: { paths: ['a.ts'] },
      dynamic: false,
      invalid: false,
    }
    const streamTextMock = mock(() => createFakeStreamResult([validPart]))
    await mockModule('ai', () => ({
      streamText: streamTextMock,
    }))

    const { collected, streamError } = await collectChunks([validPart])

    expect(streamError).toBeNull()
    const forwarded = collected.find(
      (c) =>
        typeof c === 'object' &&
        c !== null &&
        (c as { type?: string }).type === 'tool-call',
    ) as { toolCallId?: string; toolName?: string } | undefined
    expect(forwarded).toBeDefined()
    expect(forwarded?.toolCallId).toBe('call-3')
    expect(forwarded?.toolName).toBe('read_files')
    expect(
      collected.some(
        (c) =>
          typeof c === 'object' &&
          c !== null &&
          (c as { errorClass?: string }).errorClass === 'native-incomplete',
      ),
    ).toBe(false)
  })
})

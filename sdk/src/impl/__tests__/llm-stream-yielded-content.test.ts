import {
  clearMockedModules,
  mockModule,
} from '@savant-code/common/testing/mock-modules'
import * as realAiModule from 'ai'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

// FID-2026-0803-003 SDK-2 regression: hasYieldedContent must be set when
// tool-call chunks are yielded, so a ChatGPT OAuth rate-limit error arriving
// after a tool call does NOT trigger the re-stream fallback (which would
// deliver the tool call twice → duplicate execution).

const REAL_FETCH = globalThis.fetch

function createFakeStreamResult() {
  return {
    fullStream: (async function* () {
      yield {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'read-files',
        args: { paths: ['a.ts'] },
      }
      yield { type: 'error', error: { statusCode: 429, message: 'rate limit' } }
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

describe('promptAiSdkStream hasYieldedContent tracking', () => {
  const getValidChatGptOAuthCredentialsMock = mock<
    () => Promise<{ accessToken: string } | null>
  >(() => Promise.resolve(null))
  let streamTextMock: ReturnType<typeof mock>

  beforeEach(async () => {
    streamTextMock = mock(() => createFakeStreamResult())

    // Force the ChatGPT OAuth path so the stream's 429 classifier applies.
    // Uses mockModule helper since this is an absolute package specifier.
    await mockModule('@savant-code/common/constants/chatgpt-oauth', () => ({
      CHATGPT_OAUTH_ENABLED: true,
    }))

    // Provide valid OAuth credentials (mirrors model-provider-free-mode.test.ts).
    mock.module('../../credentials', () => ({
      getValidChatGptOAuthCredentials: getValidChatGptOAuthCredentialsMock,
      refreshChatGptOAuthToken: mock(() => Promise.resolve(false)),
    }))

    // Override only streamText — transitive modules (e.g. common/util/messages)
    // import other 'ai' exports (modelMessageSchema) that must stay intact.
    mock.module('ai', () => ({
      ...realAiModule,
      streamText: streamTextMock,
    }))

    getValidChatGptOAuthCredentialsMock.mockReset()
    getValidChatGptOAuthCredentialsMock.mockResolvedValue({
      accessToken: 'test-token',
    })
  })

  afterEach(() => {
    mock.restore()
    globalThis.fetch = REAL_FETCH
    clearMockedModules()
  })

  test('does not re-stream after a tool call is yielded on OAuth rate limit', async () => {
    const { promptAiSdkStream } = await import('../llm')

    const gen = promptAiSdkStream({
      apiKey: 'test-key',
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

    // The tool call was yielded, then the 429 error was thrown as fatal — the
    // fallback must NOT have re-streamed (which would duplicate the tool call).
    expect(streamError).not.toBeNull()
    expect(
      collected.some((c) => (c as { type?: string }).type === 'tool-call'),
    ).toBe(true)
    expect(streamTextMock).toHaveBeenCalledTimes(1)
  })
})

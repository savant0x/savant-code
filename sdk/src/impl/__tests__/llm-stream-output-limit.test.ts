import {
  clearMockedModules,
  mockModule,
} from '@savant-code/common/testing/mock-modules'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

// FID-2026-1005-001: an output-limit stop (`finishReason: 'length'`) on a
// TEXT-only stream must surface an explicit error chunk — a truncated
// fragment must never relay as a complete verdict. A stream that produced a
// tool call is under the native-incomplete contract (FID-2026-0909-008) and
// must not double-fire; a clean `stop` must stay silent.

const REAL_FETCH = globalThis.fetch

type FakePart =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string }
  | { type: 'finish'; finishReason: string }

function createFakeStreamResult(parts: FakePart[]) {
  return {
    fullStream: (async function* () {
      for (const part of parts) yield part
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

describe('promptAiSdkStream output-limit handling (FID-2026-1005-001)', () => {
  let streamTextMock: ReturnType<typeof mock>
  let currentParts: FakePart[]

  beforeEach(async () => {
    currentParts = []
    streamTextMock = mock(() => createFakeStreamResult(currentParts))
    await mockModule('ai', () => ({
      streamText: streamTextMock,
    }))
  })

  afterEach(() => {
    mock.restore()
    globalThis.fetch = REAL_FETCH
    clearMockedModules()
  })

  async function collect(): Promise<Array<{ type: string; message?: string }>> {
    const { promptAiSdkStream } = await import('../llm/stream')
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
    const collected: Array<{ type: string; message?: string }> = []
    for await (const chunk of gen) {
      collected.push(chunk as { type: string; message?: string })
    }
    return collected
  }

  test('a length-cut text-only stream yields the explicit output-limit error', async () => {
    currentParts = [
      { type: 'text-delta', text: 'VERDICT-PREFIX: partial analysi' },
      { type: 'finish', finishReason: 'length' },
    ]
    const chunks = await collect()
    const errors = chunks.filter((c) => c.type === 'error')
    expect(errors).toHaveLength(1)
    expect(errors[0]?.message).toContain('Output limit reached')
    expect(errors[0]?.message).toContain('partial fragment')
    // The partial text still streamed first — the fragment is preserved.
    expect(
      chunks.some(
        (c) => c.type === 'text' && String(c).includes('VERDICT-PREFIX'),
      ),
    ).toBe(false)
  })

  test('a length stop after a tool call does not double-fire (native-incomplete owns that cut)', async () => {
    currentParts = [
      { type: 'text-delta', text: 'some text' },
      { type: 'tool-call', toolCallId: 'call-1', toolName: 'read_files' },
      { type: 'finish', finishReason: 'length' },
    ]
    const chunks = await collect()
    const errors = chunks.filter(
      (c) => c.type === 'error' && c.message?.includes('Output limit reached'),
    )
    expect(errors).toHaveLength(0)
  })

  test('a clean stop yields no output-limit error', async () => {
    currentParts = [
      { type: 'text-delta', text: 'complete answer' },
      { type: 'finish', finishReason: 'stop' },
    ]
    const chunks = await collect()
    expect(
      chunks.filter((c) => c.type === 'error' && c.message?.includes('Output')),
    ).toHaveLength(0)
  })
})

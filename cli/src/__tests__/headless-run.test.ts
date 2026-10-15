import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  HEADLESS_EXIT_ERROR,
  HEADLESS_EXIT_OK,
  HEADLESS_EXIT_USAGE,
  extractFinalAnswer,
  resolveRunTimeoutMs,
  runHeadlessPrint,
} from '../headless-run'

import type { RunState } from '@savant-code/sdk'

function fakeRunState(partial: Partial<RunState> = {}): RunState {
  return {
    output: {
      type: 'lastMessage',
      value: [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello from headless' }],
        },
      ],
    },
    sessionState: {
      mainAgentState: {
        messageHistory: [],
      },
    },
    ...partial,
  } as unknown as RunState
}

// DI (dependency injection) over module mocking: pass the injected client,
// agent, and definitions so no mock.module is needed (which would leak across
// bun test files sharing a worker).
const TEST_AGENT = 'savant-code/base-lite'

let originalStdoutIsTTY: unknown

beforeEach(() => {
  originalStdoutIsTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY')
})

afterEach(() => {
  if (originalStdoutIsTTY) {
    Object.defineProperty(process.stdout, 'isTTY', originalStdoutIsTTY)
  }
})

describe('runHeadlessPrint exit-code contract', () => {
  test('returns the final answer and exit 0 on success', async () => {
    const client = {
      run: async () => fakeRunState(),
    }
    const result = await runHeadlessPrint({
      prompt: 'hello',
      resolvedAgent: TEST_AGENT,
      getClient: async () => client as never,
    })

    expect(result.exitCode).toBe(HEADLESS_EXIT_OK)
    expect(result.output).toBe('Hello from headless\n')
    expect(result.error).toBeUndefined()
  })

  test('returns the error message and exit 1 on error output', async () => {
    const client = {
      run: async () =>
        fakeRunState({
          output: {
            type: 'error',
            message: 'Provider returned 429',
          },
        } as never),
    }
    const result = await runHeadlessPrint({
      prompt: 'hello',
      resolvedAgent: TEST_AGENT,
      getClient: async () => client as never,
    })

    expect(result.exitCode).toBe(HEADLESS_EXIT_ERROR)
    expect(result.error).toBe('Provider returned 429')
    expect(result.output).toBeUndefined()
  })

  test('returns exit 2 for an empty prompt without calling the client', async () => {
    let called = false
    const result = await runHeadlessPrint({
      prompt: '   ',
      resolvedAgent: TEST_AGENT,
      getClient: async () => {
        called = true
        return null
      },
    })

    expect(result.exitCode).toBe(HEADLESS_EXIT_USAGE)
    expect(result.error).toContain('--print requires a prompt')
    expect(called).toBe(false)
  })

  test('returns exit 1 when the client cannot be initialized', async () => {
    const result = await runHeadlessPrint({
      prompt: 'hello',
      resolvedAgent: TEST_AGENT,
      getClient: async () => null,
    })

    expect(result.exitCode).toBe(HEADLESS_EXIT_ERROR)
    expect(result.error).toContain('Failed to initialize the SDK client')
  })

  test('aborts and returns exit 1 when the run exceeds the timeout', async () => {
    const client = {
      run: async (runOptions: { signal?: AbortSignal }) => {
        const signal = runOptions.signal
        // The timeout must abort the signal. Race a fallback timer: in bun
        // test, an abort-listener resolve does not wake a bare await, so the
        // race keeps the continuation on a normal timer tick.
        await Promise.race([
          new Promise((resolve) => {
            signal?.addEventListener('abort', () => resolve('aborted'))
          }),
          new Promise((resolve) =>
            setTimeout(() => resolve('no-abort'), 60_000),
          ),
        ])
        // Mirror the SDK: reject with the abort reason.
        const reason = signal?.reason
        throw reason instanceof Error ? reason : new Error('Aborted by caller')
      },
    }
    const result = await runHeadlessPrint({
      prompt: 'hello',
      timeoutMs: 50,
      resolvedAgent: TEST_AGENT,
      getClient: async () => client as never,
    })

    expect(result.exitCode).toBe(HEADLESS_EXIT_ERROR)
    expect(result.error).toContain('timed out')
  })

  test('returns exit 1 with the thrown message on a rejected run', async () => {
    const client = {
      run: async () => {
        throw new Error('Boom')
      },
    }
    const result = await runHeadlessPrint({
      prompt: 'hello',
      resolvedAgent: TEST_AGENT,
      getClient: async () => client as never,
    })

    expect(result.exitCode).toBe(HEADLESS_EXIT_ERROR)
    expect(result.error).toBe('Boom')
  })

  test('strips ANSI codes when stdout is not a TTY', async () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: false,
      configurable: true,
    })
    const client = {
      run: async () =>
        fakeRunState({
          output: {
            type: 'lastMessage',
            value: [
              {
                role: 'assistant',
                content: [
                  { type: 'text', text: '\u001b[32mgreen answer\u001b[0m' },
                ],
              },
            ],
          },
        } as never),
    }
    const result = await runHeadlessPrint({
      prompt: 'hello',
      resolvedAgent: TEST_AGENT,
      getClient: async () => client as never,
    })

    expect(result.exitCode).toBe(HEADLESS_EXIT_OK)
    expect(result.output).toBe('green answer\n')
  })
})

describe('extractFinalAnswer', () => {
  test('prefers the lastMessage output', () => {
    const state = fakeRunState({
      output: {
        type: 'lastMessage',
        value: [
          { role: 'user', content: [{ type: 'text', text: 'hi' }] },
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'the answer' }],
          },
        ],
      },
    } as never)
    expect(extractFinalAnswer(state)).toBe('the answer')
  })

  test('falls back to session message history', () => {
    const state = fakeRunState({
      output: undefined,
      sessionState: {
        mainAgentState: {
          messageHistory: [
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'from history' }],
            },
          ],
        },
      },
    } as never)
    expect(extractFinalAnswer(state)).toBe('from history')
  })

  test('returns an empty string when there is no assistant text', () => {
    expect(
      extractFinalAnswer(fakeRunState({ output: undefined } as never)),
    ).toBe('')
  })
})

describe('resolveRunTimeoutMs', () => {
  test('defaults to 10 minutes', () => {
    expect(resolveRunTimeoutMs(undefined)).toBe(10 * 60 * 1000)
  })

  test('parses a valid env value', () => {
    expect(resolveRunTimeoutMs('5000')).toBe(5000)
  })

  test('ignores invalid values', () => {
    expect(resolveRunTimeoutMs('abc')).toBe(10 * 60 * 1000)
    expect(resolveRunTimeoutMs('0')).toBe(10 * 60 * 1000)
    expect(resolveRunTimeoutMs('-1')).toBe(10 * 60 * 1000)
  })
})

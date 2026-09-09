import { describe, expect, test } from 'bun:test'

import {
  HEADLESS_EXIT_ERROR,
  HEADLESS_EXIT_OK,
  runHeadlessPrint,
} from '../headless-run'

import type { ControlInputStream } from '../headless-ndjson'
import type { RunState } from '@savant-code/sdk'

const TEST_AGENT = 'savant-code/base-lite'

function fakeRunState(): RunState {
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
  } as unknown as RunState
}

/**
 * Injectable ControlInputStream double (FID-2026-0907-006 DI param): records
 * `on` subscriptions and lets tests push chunks / EOF exactly as a real
 * stdin would deliver them.
 */
function fakeControlInput(): {
  input: ControlInputStream
  emitData: (chunk: string) => void
  emitEnd: () => void
  onCallCount: () => number
} {
  const listeners = new Map<string, (chunk?: Buffer | string) => void>()
  let calls = 0
  return {
    input: {
      on: (event, listener) => {
        calls += 1
        listeners.set(event, listener)
        return listeners
      },
    },
    emitData: (chunk) => listeners.get('data')?.(chunk),
    emitEnd: () => listeners.get('end')?.(),
    onCallCount: () => calls,
  }
}

type RunOptions = {
  signal?: AbortSignal
  handleEvent?: (event: never) => void
}

// FID-2026-0907-006 — BO Phase 2 acceptance gates: cancel mid-run exits
// cooperatively with no frames after the ack; steer is accepted + parked;
// unknown/foreign frames are ignored; EOF-only stdin never blocks; non-JSON
// mode never attaches a reader.
describe('runHeadlessPrint control frames (FID-2026-0907-006)', () => {
  test('cancel mid-run aborts cooperatively: exit 1, cancel reason, no frames after the ack', async () => {
    const control = fakeControlInput()
    const lines: string[] = []
    const client = {
      run: async (runOptions: RunOptions) => {
        // The parent writes the cancel frame on stdin, then an agent event
        // arrives — the step boundary must drain the cancel FIRST and stop.
        control.emitData('{"v":1,"type":"cancel"}\n')
        runOptions.handleEvent?.({
          type: 'tool_call',
          toolCallId: 't1',
          toolName: 'read_files',
        } as never)
        // Mirror the SDK: race the abort signal (short fallback so a missing
        // wiring fails fast instead of hanging).
        await Promise.race([
          new Promise((resolve) => {
            runOptions.signal?.addEventListener('abort', () =>
              resolve('aborted'),
            )
          }),
          new Promise((resolve) =>
            setTimeout(() => resolve('no-abort'), 2_000),
          ),
        ])
        const reason = runOptions.signal?.reason
        throw reason instanceof Error ? reason : new Error('Aborted by caller')
      },
    }

    const result = await runHeadlessPrint({
      prompt: 'hello',
      resolvedAgent: TEST_AGENT,
      jsonMode: true,
      jsonFrameWriter: (line) => lines.push(line),
      jsonControlInput: control.input,
      getClient: async () => client as never,
    })

    expect(result.exitCode).toBe(HEADLESS_EXIT_ERROR)
    expect(result.error).toBe('Cancelled by parent control frame')
    // No progress frame after the cancel drained: the tool_call event's
    // boundary consumed the cancel and returned before the tap ran.
    expect(lines.some((line) => line.includes('tool_call_started'))).toBe(false)
  })

  test('cancel with NO stream boundary aborts at arrival (held request, FID-2026-0907-007 case 4)', async () => {
    const control = fakeControlInput()
    const lines: string[] = []
    const client = {
      run: async (runOptions: RunOptions) => {
        // The held-request analog (live matrix case 4): the parent writes the
        // cancel but NO handleEvent/handleStreamChunk boundary ever fires
        // while the request is in flight. The reader's arrival-time onCancel
        // must abort regardless of stream state — waiting for the next
        // boundary rode the run timeout (92s live).
        control.emitData('{"v":1,"type":"cancel"}\n')
        await Promise.race([
          new Promise((resolve) => {
            runOptions.signal?.addEventListener('abort', () =>
              resolve('aborted'),
            )
          }),
          new Promise((resolve) =>
            setTimeout(() => resolve('no-abort'), 2_000),
          ),
        ])
        if (!(runOptions.signal?.aborted ?? false)) {
          throw new Error('cancel did not abort at arrival')
        }
        const reason = runOptions.signal?.reason
        throw reason instanceof Error ? reason : new Error('Aborted by caller')
      },
    }

    const result = await runHeadlessPrint({
      prompt: 'hello',
      resolvedAgent: TEST_AGENT,
      jsonMode: true,
      jsonFrameWriter: (line) => lines.push(line),
      jsonControlInput: control.input,
      getClient: async () => client as never,
    })

    expect(result.exitCode).toBe(HEADLESS_EXIT_ERROR)
    expect(result.error).toBe('Cancelled by parent control frame')
    // No frames after the ack: the artifact must never land on a cancelled run.
    expect(lines.some((line) => line.includes('"artifact"'))).toBe(false)
  })

  test('steer is accepted + parked and the run completes', async () => {
    const control = fakeControlInput()
    const lines: string[] = []
    const client = {
      run: async (runOptions: RunOptions) => {
        control.emitData(
          '{"v":1,"type":"steer","data":{"note":"focus on tests"}}\n',
        )
        runOptions.handleEvent?.({
          type: 'tool_call',
          toolCallId: 't1',
          toolName: 'read_files',
        } as never)
        return fakeRunState()
      },
    }

    const result = await runHeadlessPrint({
      prompt: 'hello',
      resolvedAgent: TEST_AGENT,
      jsonMode: true,
      jsonFrameWriter: (line) => lines.push(line),
      jsonControlInput: control.input,
      getClient: async () => client as never,
    })

    expect(result.exitCode).toBe(HEADLESS_EXIT_OK)
    expect(result.parkedSteerNotes).toEqual(['focus on tests'])
    // The run was not cancelled: the artifact frame still lands at the answer.
    expect(lines.some((line) => line.includes('"artifact"'))).toBe(true)
  })

  test('unknown and foreign control frames are ignored; the run continues', async () => {
    const control = fakeControlInput()
    const client = {
      run: async (runOptions: RunOptions) => {
        control.emitData('{"v":2,"type":"cancel"}\n') // wrong wire version
        control.emitData('not json at all\n') // malformed
        control.emitData('{"v":1,"type":"steer","data":{"note":"kept"}}\n')
        runOptions.handleEvent?.({
          type: 'tool_call',
          toolCallId: 't1',
          toolName: 'read_files',
        } as never)
        return fakeRunState()
      },
    }

    const result = await runHeadlessPrint({
      prompt: 'hello',
      resolvedAgent: TEST_AGENT,
      jsonMode: true,
      jsonFrameWriter: () => {},
      jsonControlInput: control.input,
      getClient: async () => client as never,
    })

    // The v:2 cancel must NOT have aborted the run.
    expect(result.exitCode).toBe(HEADLESS_EXIT_OK)
    expect(result.parkedSteerNotes).toEqual(['kept'])
  })

  test('EOF-only stdin never blocks the run', async () => {
    const control = fakeControlInput()
    const client = {
      run: async (runOptions: RunOptions) => {
        control.emitEnd()
        runOptions.handleEvent?.({
          type: 'tool_call',
          toolCallId: 't1',
          toolName: 'read_files',
        } as never)
        return fakeRunState()
      },
    }

    const result = await runHeadlessPrint({
      prompt: 'hello',
      resolvedAgent: TEST_AGENT,
      jsonMode: true,
      jsonFrameWriter: () => {},
      jsonControlInput: control.input,
      getClient: async () => client as never,
    })

    expect(result.exitCode).toBe(HEADLESS_EXIT_OK)
    expect(result.parkedSteerNotes).toBeUndefined()
  })

  test('non-JSON mode never attaches a control reader', async () => {
    const control = fakeControlInput()
    const client = {
      run: async () => fakeRunState(),
    }

    const result = await runHeadlessPrint({
      prompt: 'hello',
      resolvedAgent: TEST_AGENT,
      jsonControlInput: control.input,
      getClient: async () => client as never,
    })

    expect(result.exitCode).toBe(HEADLESS_EXIT_OK)
    expect(control.onCallCount()).toBe(0)
  })
})

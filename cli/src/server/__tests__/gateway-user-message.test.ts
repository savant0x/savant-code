import { describe, expect, test } from 'bun:test'

import { EVENT_FLUSH_INTERVAL_MS } from '../gateway'
import { GATEWAY_PROTOCOL_VERSION } from '../json-rpc'
import {
  collectFrames,
  createFakeRunPrompt,
  openSocket,
  request,
  startTestGateway,
  TEST_TOKEN,
} from './gateway-test-harness'

import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { RunState } from '@savant-code/sdk'

describe('gateway user_message + event stream', () => {
  test('user_message streams text chunks as printModeText and settles with run_complete', async () => {
    const runPrompt = createFakeRunPrompt({
      chunks: ['Hello', ' world'],
      events: [
        { type: 'start', messageHistoryLength: 1 },
        {
          type: 'tool_call',
          toolCallId: 't1',
          toolName: 'read_files',
          input: { filePaths: ['a'] },
        },
        { type: 'finish', totalCost: 0.01 },
      ],
      resultId: 'run-abc',
    })
    const gateway = await startTestGateway({ runPrompt })
    const socket = await openSocket(gateway.port)

    // Handshake first.
    await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )

    // user_message accepted (the accepted response resolves the request), then
    // events stream, then run_complete.
    const accepted = await request(
      socket,
      'user_message',
      { prompt: 'hi there' },
      2,
    )
    expect(accepted).toMatchObject({ result: { accepted: true } })

    // The run settles at ~5ms but events flush on the ~50ms interval, so keep
    // collecting for a few flush ticks after run_complete to capture the tail.
    const frames = await collectFrames(
      socket,
      (frame) => {
        const record = frame as { method?: string }
        return record.method === 'run_complete'
      },
      3000,
      EVENT_FLUSH_INTERVAL_MS * 3,
    )
    const eventFrames = frames.filter(
      (frame) => (frame as { method?: string }).method === 'event',
    )
    const types = eventFrames
      .map((frame) => {
        const record = frame as { params?: PrintModeEvent[] }
        return (record.params ?? []).map((e) => e.type)
      })
      .flat()

    // Text chunks coalesce into printModeText events (TokenStreamEvent →
    // printModeText mapping); structural events pass through verbatim.
    expect(types).toContain('text')
    expect(types).toContain('tool_call')
    expect(types).toContain('finish')
    const complete = frames.find(
      (frame) => (frame as { method?: string }).method === 'run_complete',
    ) as { params?: { ok: boolean; runId: string } }
    expect(complete.params?.ok).toBe(true)
    expect(complete.params?.runId).toBe('run-abc')
    socket.close()
  })

  test('a second user_message while a run is in flight gets -32004 sessionBusy', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const runPrompt = createFakeRunPrompt({
      onStart: () => {
        void gate
      },
      delayMs: 500,
    })
    // Hold the run open until we release it.
    const heldRunPrompt = async (params: {
      prompt: string
      previousRun?: RunState
      signal: AbortSignal
      onEvent: (event: PrintModeEvent) => void
      onTextChunk: (chunk: string) => void
    }): Promise<RunState> => {
      await gate
      return runPrompt(params)
    }
    const gateway = await startTestGateway({ runPrompt: heldRunPrompt })
    const socket = await openSocket(gateway.port)
    await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )

    // First run starts and stays in flight.
    const firstAccepted = await request(
      socket,
      'user_message',
      { prompt: 'first' },
      2,
    )
    expect(firstAccepted).toMatchObject({ result: { accepted: true } })

    // Second run is rejected with sessionBusy.
    const busy = (await request(
      socket,
      'user_message',
      { prompt: 'second' },
      3,
    )) as {
      error?: { code: number }
    }
    expect(busy.error?.code).toBe(-32004)

    release()
    socket.close()
  })
})

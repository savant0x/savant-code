import { describe, expect, test } from 'bun:test'

import { GATEWAY_PROTOCOL_VERSION } from '../json-rpc'
import {
  createFakeRunPrompt,
  fakeRunState,
  openSocket,
  request,
  startTestGateway,
  TEST_TOKEN,
} from './gateway-test-harness'

import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { RunState } from '@savant-code/sdk'

describe('gateway interrupt + reconnect recovery', () => {
  test('interrupt_stream aborts the in-flight run', async () => {
    const signalHolder: { current: AbortSignal | null } = { current: null }
    const runPrompt = createFakeRunPrompt({
      onStart: (sig) => {
        signalHolder.current = sig
      },
      delayMs: 500,
    })
    const gateway = await startTestGateway({ runPrompt })
    const socket = await openSocket(gateway.port)
    await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )
    await request(socket, 'user_message', { prompt: 'run long' }, 2)

    const interrupt = (await request(socket, 'interrupt_stream', {}, 3)) as {
      result?: { interrupting: boolean }
    }
    expect(interrupt.result?.interrupting).toBe(true)
    expect(signalHolder.current?.aborted).toBe(true)
    socket.close()
  })

  test('interrupt_stream with no run in flight is rejected', async () => {
    const gateway = await startTestGateway()
    const socket = await openSocket(gateway.port)
    await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )
    const response = (await request(socket, 'interrupt_stream', {}, 4)) as {
      error?: { code: number }
    }
    expect(response.error?.code).toBe(-32600)
    socket.close()
  })

  test('reconnect reuses the last settled RunState when no previousRun sent', async () => {
    const seenPrevious: (RunState | undefined)[] = []
    const runPrompt = async (params: {
      prompt: string
      previousRun?: RunState
      signal: AbortSignal
      onEvent: (event: PrintModeEvent) => void
      onTextChunk: (chunk: string) => void
    }): Promise<RunState> => {
      seenPrevious.push(params.previousRun)
      return fakeRunState('run-reconnect')
    }
    const gateway = await startTestGateway({ runPrompt })

    // Run 1 (no previous state).
    const socket1 = await openSocket(gateway.port)
    await request(
      socket1,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )
    await request(socket1, 'user_message', { prompt: 'first' }, 2)
    socket1.close()

    // Reconnect with a fresh socket: the gateway reuses the last RunState.
    const socket2 = await openSocket(gateway.port)
    await request(
      socket2,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )
    await request(socket2, 'user_message', { prompt: 'second' }, 2)
    socket2.close()

    expect(seenPrevious.length).toBe(2)
    expect(seenPrevious[0]).toBeUndefined()
    expect(seenPrevious[1]?.traceSessionId).toBe('run-reconnect')
  })

  test('a client-supplied previousRun wins over the in-process state', async () => {
    const seenPrevious: (RunState | undefined)[] = []
    const runPrompt = async (params: {
      prompt: string
      previousRun?: RunState
      signal: AbortSignal
      onEvent: (event: PrintModeEvent) => void
      onTextChunk: (chunk: string) => void
    }): Promise<RunState> => {
      seenPrevious.push(params.previousRun)
      return fakeRunState('run-client-state')
    }
    const gateway = await startTestGateway({ runPrompt })

    // Run 1 settles, storing the in-process state.
    const socket1 = await openSocket(gateway.port)
    await request(
      socket1,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )
    await request(socket1, 'user_message', { prompt: 'first' }, 2)
    socket1.close()

    // Run 2 carries an explicit previousRun — it must win.
    const socket2 = await openSocket(gateway.port)
    await request(
      socket2,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )
    await request(
      socket2,
      'user_message',
      { prompt: 'second', previousRun: fakeRunState('client-side-state') },
      2,
    )
    socket2.close()

    expect(seenPrevious[1]?.traceSessionId).toBe('client-side-state')
  })
})

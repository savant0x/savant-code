// FID-2026-1003-002 (T113 audit D6) — gateway reconnect event replay.
//
// The wire invariant under test: every `event` frame the gateway emits goes
// through ONE seq-stamped emission primitive (no seq leaks onto the wire —
// live frames stay bare PrintModeEvent[] arrays), disconnected batches land
// in the bounded replay buffer, and `replay_events` recovers them in order
// with honest gap reporting.

import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, test } from 'bun:test'

import { EVENT_FLUSH_INTERVAL_MS } from '../gateway'
import { handleReplayEvents } from '../gateway/replay-rpc'
import {
  createGatewayContext,
  emitEventBatch,
  REPLAY_BUFFER_CAP,
} from '../gateway/state'
import { GATEWAY_PROTOCOL_VERSION } from '../json-rpc'
import {
  fakeRunState,
  openSocket,
  request,
  startTestGateway,
  TEST_TOKEN,
} from './gateway-test-harness'

import type { GatewayContext } from '../gateway/state'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { RunState } from '@savant-code/sdk'

function unitContext(): GatewayContext {
  return createGatewayContext({
    token: 'unit-token',
    projectId: 'unit-project',
    commands: [],
    logger: undefined,
    triggerManager: undefined,
    runPrompt: async (): Promise<RunState> => {
      throw new Error('runPrompt must not be reached in this unit')
    },
    loadScopedThreads: () => [],
    updateScopedThreadState: () => false,
  })
}

function makeTempFidsDir(): string {
  // A repo-shaped FID the loader parses; status must be a known one or
  // collectFidUpdates filters it out.
  const dir = mkdtempSync(join(tmpdir(), 'gw-replay-fids-'))
  writeFileSync(
    join(dir, 'FID-2026-0101-001-replay-fixture.md'),
    '**ID:** FID-2026-0101-001-replay-fixture\n**Status:** created\n',
    'utf8',
  )
  return dir
}

describe('gateway replay (FID-2026-1003-002 / audit D6)', () => {
  test('batches flushed while disconnected are replayed in seq order', async () => {
    // Empty fixture dir → the post-hello snapshot is an empty (no-op) batch,
    // keeping the seq space deterministic for this test.
    const fidsDir = mkdtempSync(join(tmpdir(), 'gw-replay-empty-'))
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const missed: PrintModeEvent[] = [
      { type: 'text', text: 'while ' },
      { type: 'text', text: 'away' },
    ]
    const runPrompt = async (params: {
      prompt: string
      previousRun?: RunState
      signal: AbortSignal
      onEvent: (event: PrintModeEvent) => void
      onTextChunk: (chunk: string) => void
    }): Promise<RunState> => {
      await gate
      for (const event of missed) params.onEvent(event)
      return fakeRunState('run-replay')
    }
    const gateway = await startTestGateway({ runPrompt, fidsDir })

    const socketA = await openSocket(gateway.port)
    const helloA = (await request(
      socketA,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )) as { result?: { eventSeq?: number; capabilities?: string[] } }
    expect(helloA.result?.capabilities).toContain('replay_events')
    expect(helloA.result?.eventSeq).toBe(0)

    const accepted = await request(socketA, 'user_message', { prompt: 'go' }, 2)
    expect(accepted).toMatchObject({ result: { accepted: true } })

    // Disconnect, then let the run emit — the flush tick must buffer the
    // batch even with zero connected sockets (the D6 loss window).
    socketA.close()
    release()
    await new Promise((resolve) =>
      setTimeout(resolve, EVENT_FLUSH_INTERVAL_MS * 3),
    )

    const socketB = await openSocket(gateway.port)
    const helloB = (await request(
      socketB,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      3,
    )) as { result?: { eventSeq?: number } }
    expect(helloB.result?.eventSeq).toBe(1)

    const replay = (await request(
      socketB,
      'replay_events',
      { since: 0 },
      4,
    )) as {
      result?: {
        batches: Array<{ seq: number; events: PrintModeEvent[] }>
        earliestSeq: number | null
        latestSeq: number
        gapped: boolean
      }
    }
    expect(replay.result?.gapped).toBe(false)
    expect(replay.result?.earliestSeq).toBe(1)
    expect(replay.result?.latestSeq).toBe(1)
    expect(replay.result?.batches).toEqual([{ seq: 1, events: missed }])
    socketB.close()
  })

  test('the post-hello FID snapshot rides the seq space and is replayable', async () => {
    const fidsDir = makeTempFidsDir()
    const gateway = await startTestGateway({ fidsDir })
    const socket = await openSocket(gateway.port)
    await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )
    // The detached snapshot timer (setTimeout 0) fires after the reply.
    await new Promise((resolve) => setTimeout(resolve, 30))

    const replay = (await request(
      socket,
      'replay_events',
      { since: 0 },
      2,
    )) as {
      result?: {
        batches: Array<{ seq: number; events: PrintModeEvent[] }>
        latestSeq: number
        gapped: boolean
      }
    }
    expect(replay.result?.gapped).toBe(false)
    expect(replay.result?.latestSeq).toBe(1)
    const batch = replay.result?.batches[0]
    expect(batch?.seq).toBe(1)
    expect(batch?.events.some((event) => event.type === 'fid_update')).toBe(
      true,
    )
    socket.close()
  })

  test('replay_events validates since and reports gaps honestly', () => {
    const ctx = unitContext()
    ctx.batchSeq = 510
    ctx.replayBuffer.push({ seq: 500, events: [{ type: 'text', text: 'x' }] })
    const frames: string[] = []
    const send = (data: string): void => {
      frames.push(data)
    }

    handleReplayEvents(ctx, send, 1, { since: 100 })
    let parsed = JSON.parse(frames[0]) as {
      result?: {
        gapped: boolean
        batches: unknown[]
        earliestSeq: number | null
        latestSeq: number
      }
    }
    // Seqs 1..499 are gone (pre-buffer) → honest gap.
    expect(parsed.result?.gapped).toBe(true)
    expect(parsed.result?.batches).toHaveLength(1)
    expect(parsed.result?.earliestSeq).toBe(500)
    expect(parsed.result?.latestSeq).toBe(510)

    // Since beyond latest → nothing is missing, not gapped.
    handleReplayEvents(ctx, send, 2, { since: 600 })
    parsed = JSON.parse(frames[1])
    expect(parsed.result?.gapped).toBe(false)
    expect(parsed.result?.batches).toEqual([])

    // Invalid since → invalidRequest failure (-32600).
    handleReplayEvents(ctx, send, 3, {})
    parsed = JSON.parse(frames[2])
    expect(parsed.result).toBeUndefined()
  })

  test('emitEventBatch is the single seq space and never leaks seq onto the wire', () => {
    const ctx = unitContext()
    const sent: string[] = []
    ctx.connectedSockets.add({ send: (data) => sent.push(data) })

    emitEventBatch(ctx, [{ type: 'text', text: 'a' }])
    emitEventBatch(ctx, [{ type: 'text', text: 'b' }])
    expect(ctx.batchSeq).toBe(2)
    expect(ctx.replayBuffer.map((batch) => batch.seq)).toEqual([1, 2])
    const frame = JSON.parse(sent[0]) as { params: unknown }
    expect(Array.isArray(frame.params)).toBe(true)
    expect(sent[0]).not.toContain('"seq"')

    // Empty batches consume no seq.
    emitEventBatch(ctx, [])
    expect(ctx.batchSeq).toBe(2)

    // The buffer is bounded: the oldest batches shift out.
    for (let i = 0; i < REPLAY_BUFFER_CAP; i++) {
      emitEventBatch(ctx, [{ type: 'text', text: `e${String(i)}` }])
    }
    expect(ctx.replayBuffer.length).toBe(REPLAY_BUFFER_CAP)
    expect(ctx.replayBuffer[0].seq).toBe(3)
    expect(ctx.batchSeq).toBe(2 + REPLAY_BUFFER_CAP)
  })
})

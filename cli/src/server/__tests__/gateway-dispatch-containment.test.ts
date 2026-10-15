// FID-2026-1002-008 (T113 audit D3) — gateway dispatch error containment.
//
// Fault-injection through the harness's DI seams only (no module mocking):
// a throwing triggerManager exercises the dispatch boundary over a real
// WebSocket (triggers_set_enabled / triggers_delete are the two dispatch
// targets without internal try/catch); the two seams with no natural fault
// (the fully self-catching run-state loader, the Law-14 never-throwing FID
// loader) are pinned by direct handler units with injected fault seams
// (selective-throwing send / throwing bus).

import { describe, expect, test } from 'bun:test'

import { handleHello } from '../gateway/handshake-rpc'
import { handleUserMessage } from '../gateway/run-lifecycle'
import { createGatewayContext } from '../gateway/state'
import { GATEWAY_ERROR_CODES, GATEWAY_PROTOCOL_VERSION } from '../json-rpc'
import {
  collectFrames,
  openSocket,
  request,
  startTestGateway,
  TEST_TOKEN,
} from './gateway-test-harness'

import type { GatewayTriggerManager } from '../gateway'
import type { FidEventBus } from '../gateway/fid-events'
import type { GatewayContext } from '../gateway/state'
import type { RunState } from '@savant-code/sdk'

/** Minimal context for the direct handler units. The injected runPrompt
 *  throws if reached — these units must never start a run. */
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

/** A trigger manager whose write methods throw (the fault). */
function throwingManager(fault: string): GatewayTriggerManager {
  return {
    list: () => [],
    create: () => {
      throw new Error(fault)
    },
    setRecurrence: () => false,
    setEnabled: () => {
      throw new Error(fault)
    },
    delete: () => {
      throw new Error(fault)
    },
  }
}

async function hello(
  socket: Awaited<ReturnType<typeof openSocket>>,
  id: number | string,
): Promise<void> {
  await request(
    socket,
    'hello',
    { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
    id,
  )
}

describe('gateway dispatch error containment (FID-2026-1002-008 / audit D3)', () => {
  test('a throwing trigger handler is contained: -32603 carries the request id and the connection survives', async () => {
    const gateway = await startTestGateway({
      triggerManager: throwingManager('setEnabled boom'),
    })
    const socket = await openSocket(gateway.port)
    await hello(socket, 1)

    const contained = (await request(
      socket,
      'triggers_set_enabled',
      { triggerId: 't1', enabled: true },
      2,
    )) as { error?: { code: number; message: string } }
    expect(contained.error?.code).toBe(GATEWAY_ERROR_CODES.internalError)
    expect(contained.error?.message).toContain('Gateway handler failed')
    expect(contained.error?.message).toContain('setEnabled boom')

    // Containment must not disturb the per-socket handshake state: the
    // same connection answers a follow-up request normally.
    const followUp = (await request(socket, 'list_commands', undefined, 3)) as {
      error?: unknown
    }
    expect(followUp.error).toBeUndefined()
    socket.close()
  })

  test('the second uncontained trigger handler (delete) is contained identically', async () => {
    const gateway = await startTestGateway({
      triggerManager: throwingManager('delete boom'),
    })
    const socket = await openSocket(gateway.port)
    await hello(socket, 1)

    const contained = (await request(
      socket,
      'triggers_delete',
      { triggerId: 't1' },
      2,
    )) as { error?: { code: number; message: string } }
    expect(contained.error?.code).toBe(GATEWAY_ERROR_CODES.internalError)
    expect(contained.error?.message).toContain('delete boom')
    socket.close()
  })

  test('a rejecting runPrompt still delivers acceptance then run_complete {ok:false}, and the session unwedges', async () => {
    const gateway = await startTestGateway({
      runPrompt: async (): Promise<RunState> => {
        throw new Error('provider exploded')
      },
    })
    const socket = await openSocket(gateway.port)
    await hello(socket, 1)

    const accepted = await request(socket, 'user_message', { prompt: 'hi' }, 2)
    expect(accepted).toMatchObject({ result: { accepted: true } })

    const frames = await collectFrames(
      socket,
      (frame) => (frame as { method?: string }).method === 'run_complete',
    )
    const complete = frames.find(
      (frame) => (frame as { method?: string }).method === 'run_complete',
    ) as { params?: { ok: boolean; error?: string } }
    expect(complete.params?.ok).toBe(false)
    expect(complete.params?.error).toBe('provider exploded')

    // The failed run released the single session: a new run is accepted on
    // the same connection.
    const again = await request(socket, 'user_message', { prompt: 'again' }, 3)
    expect(again).toMatchObject({ result: { accepted: true } })
    socket.close()
  })

  test('a pre-acceptance send failure answers the request with -32603 and never rejects', async () => {
    const frames: string[] = []
    const send = (data: string): void => {
      // Fault seam: the socket dies exactly on the acceptance frame.
      if (data.includes('"accepted":true')) throw new Error('socket died')
      frames.push(data)
    }
    const ctx = unitContext()
    // Must resolve — a rejection here would be exactly the D3 defect.
    await handleUserMessage(ctx, send, 42, { prompt: 'hi' })

    // Exactly one frame went out: the containment failure for the request.
    // No acceptance, no stray run_complete.
    expect(frames).toHaveLength(1)
    const failureFrame = JSON.parse(frames[0]) as {
      id: number | string | null
      error?: { code: number; message: string }
    }
    expect(failureFrame.id).toBe(42)
    expect(failureFrame.error?.code).toBe(GATEWAY_ERROR_CODES.internalError)
    expect(failureFrame.error?.message).toContain('user_message failed')
    // The acceptance send failed before the activeRun claim, so the
    // single-session slot was never wedged.
    expect(ctx.activeRun).toBeNull()
  })

  test('a throwing post-hello FID snapshot timer is contained (hello still succeeds)', async () => {
    const sent: string[] = []
    const bus: FidEventBus = {
      collectFidUpdates: () => {
        throw new Error('inventory boom')
      },
      emitFidChanges: () => {},
      seed: () => {},
    }
    const ok = handleHello(unitContext(), bus, (data) => sent.push(data), 7, {
      protocolVersion: GATEWAY_PROTOCOL_VERSION,
      token: 'unit-token',
    })
    expect(ok).toBe(true)

    // Let the detached setTimeout(0) tick; the fault must stay contained.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(sent).toHaveLength(1)
    expect(JSON.parse(sent[0])).toMatchObject({
      id: 7,
      result: { protocolVersion: GATEWAY_PROTOCOL_VERSION },
    })
  })
})

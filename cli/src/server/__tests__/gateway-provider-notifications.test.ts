import {
  applyProviderFacts,
  emptyProviderNoticeState,
} from '@savant-code/common/providers/provider-notifications'
import { describe, expect, test } from 'bun:test'

import { handleProviderNotices } from '../gateway/provider-notifications-rpc'
import { handleReplayEvents } from '../gateway/replay-rpc'
import { createGatewayContext, emitEventBatch } from '../gateway/state'

function context() {
  return createGatewayContext({
    token: 'test',
    projectId: 'p',
    commands: [],
    logger: undefined,
    triggerManager: undefined,
    runPrompt: async () => {
      throw new Error('Not an inference event')
    },
    loadScopedThreads: () => [],
    updateScopedThreadState: () => false,
  })
}
function notice() {
  return applyProviderFacts(
    emptyProviderNoticeState(),
    'health',
    100,
    [
      {
        key: 'p',
        value: 'down',
        providerId: 'p',
        selected: true,
        severity: 'warning',
        kind: 'health-down',
        message: 'Endpoint unavailable',
      },
    ],
    100,
  ).notices[0]
}
describe('provider notice transport', () => {
  test('live and replay capability filtering retain an empty legacy batch and sequence position', () => {
    const ctx = context()
    const legacy: string[] = [],
      modern: string[] = [],
      unauthenticated: string[] = []
    ctx.connectedSockets.add({
      data: { authed: true, helloReceived: true },
      send: (s) => legacy.push(s),
    })
    ctx.connectedSockets.add({
      data: { authed: true, helloReceived: true, providerNotices: true },
      send: (s) => modern.push(s),
    })
    ctx.connectedSockets.add({
      data: { authed: false, helloReceived: false },
      send: (s) => unauthenticated.push(s),
    })
    emitEventBatch(ctx, [{ type: 'provider_notice', notice: notice() }])
    expect(JSON.parse(legacy[0]).params).toEqual([])
    expect(JSON.parse(modern[0]).params[0].type).toBe('provider_notice')
    expect(unauthenticated).toHaveLength(0)
    expect(ctx.batchSeq).toBe(1)
    let replay = ''
    handleReplayEvents(
      ctx,
      (s) => {
        replay = s
      },
      1,
      { since: 0 },
      false,
    )
    expect(JSON.parse(replay).result.batches).toEqual([{ seq: 1, events: [] }])
    handleReplayEvents(
      ctx,
      (s) => {
        replay = s
      },
      1,
      { since: 0 },
      true,
    )
    expect(JSON.parse(replay).result.batches[0].events[0].notice.id).toBe(
      notice().id,
    )
    expect(ctx.lastRunState).toBeNull()
  })
  test('unnegotiated and malformed acknowledgement RPCs fail closed', () => {
    let frame = ''
    const send = (s: string) => {
      frame = s
    }
    handleProviderNotices(send, 1, 'provider_notices_snapshot', {}, false)
    expect(JSON.parse(frame).error.message).toContain('not negotiated')
    handleProviderNotices(
      send,
      1,
      'provider_notices_ack',
      { id: 'x', surface: 'cli', action: 'read' },
      true,
    )
    expect(JSON.parse(frame).error.message).toContain('Invalid')
  })
})

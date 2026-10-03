// FID-2026-1002-007 (D5) — gateway event flush timer lifecycle.
//
// Pins the batching primitive's timer states: the timer exists only while
// events are pending, self-stops when the buffer drains, and re-arms on the
// next push. Uses the real GatewayContext factory — no run, no sockets —
// so each state transition is asserted directly.

import { describe, expect, test } from 'bun:test'

import {
  createGatewayContext,
  ensureFlushTimer,
  flushEvents,
  pushEvent,
} from '../gateway/state'
import { EVENT_FLUSH_INTERVAL_MS } from '../gateway/types'
import { notification } from '../json-rpc'

function freshContext() {
  return createGatewayContext({
    token: 't',
    projectId: 'p',
    commands: [],
    logger: undefined,
    triggerManager: undefined,
    runPrompt: async () => {
      throw new Error('not used in this suite')
    },
    loadScopedThreads: () => [],
    updateScopedThreadState: () => false,
  })
}

describe('gateway flush timer lifecycle (FID-2026-1002-007 D5)', () => {
  test('no timer before the first event; push arms it', () => {
    const ctx = freshContext()
    expect(ctx.flushTimer).toBeNull()
    pushEvent(ctx, { type: 'text', text: 'a' })
    ensureFlushTimer(ctx)
    expect(ctx.flushTimer).not.toBeNull()
    // Cleanup for the assertion's own timer.
    clearInterval(ctx.flushTimer!)
  })

  test('a flush with an empty buffer self-stops the timer', () => {
    const ctx = freshContext()
    pushEvent(ctx, { type: 'text', text: 'a' })
    ensureFlushTimer(ctx)
    expect(ctx.flushTimer).not.toBeNull()
    // Fire one flush synchronously via the exported primitive: the buffer
    // drains and the timer self-stops (idle sessions stop ticking).
    flushEvents(ctx)
    expect(ctx.flushTimer).toBeNull()
    expect(ctx.eventBuffer.length).toBe(0)
  })

  test('a tick after the drain is a no-op and does not resurrect the timer', async () => {
    const ctx = freshContext()
    pushEvent(ctx, { type: 'text', text: 'a' })
    ensureFlushTimer(ctx)
    flushEvents(ctx)
    expect(ctx.flushTimer).toBeNull()
    // The previously-armed interval was cleared; waiting past one tick
    // must not re-create it (the old code left the interval running,
    // whose callback would have called flushEvents on an empty buffer).
    await new Promise((resolve) =>
      setTimeout(resolve, EVENT_FLUSH_INTERVAL_MS + 20),
    )
    expect(ctx.flushTimer).toBeNull()
  })

  test('push after a drain re-arms the timer', () => {
    const ctx = freshContext()
    pushEvent(ctx, { type: 'text', text: 'a' })
    ensureFlushTimer(ctx)
    flushEvents(ctx)
    expect(ctx.flushTimer).toBeNull()
    pushEvent(ctx, { type: 'text', text: 'b' })
    ensureFlushTimer(ctx)
    expect(ctx.flushTimer).not.toBeNull()
    clearInterval(ctx.flushTimer!)
  })

  test('the flushed frame is one JSON-RPC notification carrying the batch', () => {
    const ctx = freshContext()
    const sent: string[] = []
    ctx.connectedSockets.add({
      send: (data) => {
        sent.push(data)
      },
    })
    pushEvent(ctx, { type: 'text', text: 'a' })
    pushEvent(ctx, { type: 'text', text: 'b' })
    flushEvents(ctx)
    expect(sent.length).toBe(1)
    const frame = JSON.parse(sent[0]!) as {
      method?: string
      params?: unknown
    }
    expect(frame.method).toBe('event')
    expect(frame.params).toEqual([
      { type: 'text', text: 'a' },
      { type: 'text', text: 'b' },
    ])
    expect(notification('event', [{ type: 'text', text: 'a' }]).method).toBe(
      'event',
    )
  })
})

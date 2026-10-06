/**
 * Root-stream adaptive publication (FID-2026-1006-002 WP10 wiring).
 *
 * The publisher's own timing contract is pinned in
 * `cli/src/state/__tests__/adaptive-publisher.test.ts`; this suite pins the
 * WIRING: which deltas the root stream hands over, in what order they reach
 * the transcript, and that a throttled delta can never be reordered behind an
 * event's own transcript append or lost.
 */

import { beforeEach, describe, expect, it } from 'bun:test'

import {
  createEventHandler,
  createStreamChunkHandler,
  createTestContext,
} from './sdk-event-handlers-test-harness'
import { disposeRootStreamPublisher } from '../sdk-event-handlers/root-stream-publisher'

import type { ChatMessage } from '../../types/chat'

/** A manual clock + timer queue, so no test waits on a real timer. */
function createManualClock() {
  let current = 0
  let nextId = 0
  const queue = new Map<number, { at: number; run: () => void }>()
  return {
    now: () => current,
    schedule: (run: () => void, delayMs: number) => {
      const id = (nextId += 1)
      queue.set(id, { at: current + delayMs, run })
      return () => {
        queue.delete(id)
      }
    },
    armedTimers: () => queue.size,
    advance(ms: number) {
      current += ms
      for (const [id, entry] of [...queue]) {
        if (entry.at <= current) {
          queue.delete(id)
          entry.run()
        }
      }
    },
  }
}

/** The transcript's text, in block order (what a reader would see). */
function transcriptText(messages: ChatMessage[]): string {
  return messages
    .flatMap((message) => message.blocks ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.content)
    .join('')
}

const REASONING_EVENT = (chunk: string) => ({
  type: 'reasoning_chunk' as const,
  agentId: 'root',
  ancestorRunIds: [] as string[],
  chunk,
})

const COMPLIANCE_EVENT = {
  type: 'compliance_warning' as const,
  law: 'law1',
  severity: 'info' as const,
  message: 'notice',
}

describe('root stream adaptive publication (FID-2026-1006-002 WP10)', () => {
  let clock: ReturnType<typeof createManualClock>

  beforeEach(() => {
    clock = createManualClock()
  })

  function setup() {
    const { ctx, getMessages } = createTestContext()
    const handler = createStreamChunkHandler(ctx, {
      now: clock.now,
      schedule: clock.schedule,
    })
    return { ctx, getMessages, handler }
  }

  it('publishes the first delta after idle immediately, with no timer armed', () => {
    const { getMessages, handler } = setup()

    handler('hello')

    expect(transcriptText(getMessages())).toBe('hello')
    expect(clock.armedTimers()).toBe(0)
  })

  it('coalesces a burst into one trailing publication of every delta, in order', () => {
    const { getMessages, handler } = setup()

    handler('a')
    handler('b')
    handler('c')

    // Only the immediate publication has landed so far...
    expect(transcriptText(getMessages())).toBe('a')
    expect(clock.armedTimers()).toBe(1)

    clock.advance(16)

    // ...and the trailing timer delivers the rest, in arrival order.
    expect(transcriptText(getMessages())).toBe('abc')
    expect(clock.armedTimers()).toBe(0)
  })

  it('never reorders text behind reasoning (one ordered queue for both kinds)', () => {
    const { getMessages, handler } = setup()

    handler('a')
    handler(REASONING_EVENT('R'))
    handler('b')

    clock.advance(1000)

    expect(transcriptText(getMessages())).toBe('aRb')
  })

  it('an event flushes what the stream still owes, before its own append', () => {
    const { ctx, getMessages, handler } = setup()
    const dispatch = createEventHandler(ctx)

    handler('owed')
    handler(' text')
    dispatch(COMPLIANCE_EVENT)

    // The compliance notice appended its own line, and the throttled deltas
    // came first — neither lost nor reordered.
    const text = transcriptText(getMessages())
    expect(text.startsWith('owed text')).toBe(true)
    expect(text).toContain('ECHO Law 1')
    expect(clock.armedTimers()).toBe(0)
  })

  it('delivers a large burst exactly once, whatever the schedule does', () => {
    const { getMessages, handler } = setup()
    const expected = Array.from({ length: 200 }, (_, index) => `[${index}]`)

    for (const chunk of expected) handler(chunk)
    clock.advance(1000)
    // Drain anything the schedule left behind (the last publication buys its
    // own delay, so keep advancing until no timer remains).
    while (clock.armedTimers() > 0) clock.advance(1000)

    expect(transcriptText(getMessages())).toBe(expected.join(''))
  })

  it('a disposed publisher starts a fresh window (nothing is republished)', () => {
    const { ctx, getMessages, handler } = setup()

    handler('one')
    disposeRootStreamPublisher(ctx)
    handler('two')

    expect(transcriptText(getMessages())).toBe('onetwo')
    expect(clock.armedTimers()).toBe(0)
  })

  it('leaves the agent-scoped chunk path untouched (no root publication)', () => {
    const { getMessages, handler } = setup()

    handler({
      type: 'subagent_chunk',
      agentId: 'agent-1',
      agentType: 'Detective',
      chunk: 'agent text',
    })

    expect(transcriptText(getMessages())).toBe('')
    expect(clock.armedTimers()).toBe(0)
  })
})

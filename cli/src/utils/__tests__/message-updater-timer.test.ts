// Message-updater test family — batched updater timer behavior (mocked
// setInterval/clearInterval). Sibling of the Loop-345 decomposition (parent:
// message-updater.test.ts; shared fixtures in
// ./message-updater-test-harness).
import { beforeEach, describe, expect, test, afterEach } from 'bun:test'

import {
  createBatchedMessageUpdater,
  DEFAULT_FLUSH_INTERVAL_MS,
} from '../message-updater'

import type { ChatMessage } from '../../types/chat'

const baseMessages: ChatMessage[] = [
  {
    id: 'ai-1',
    variant: 'ai',
    content: '',
    blocks: [],
    timestamp: 'now',
  },
  {
    id: 'user-1',
    variant: 'user',
    content: 'hi',
    timestamp: 'now',
  },
]

describe('createBatchedMessageUpdater timer behavior', () => {
  let originalSetInterval: typeof setInterval
  let originalClearInterval: typeof clearInterval
  let intervalCallbacks: Map<number, () => void>
  let nextIntervalId: number
  let clearedIntervals: number[]
  let createdIntervals: Array<{ id: number; ms: number }>

  beforeEach(() => {
    originalSetInterval = globalThis.setInterval
    originalClearInterval = globalThis.clearInterval
    intervalCallbacks = new Map()
    nextIntervalId = 1
    clearedIntervals = []
    createdIntervals = []

    // Mock setInterval
    globalThis.setInterval = ((callback: () => void, ms: number) => {
      const id = nextIntervalId++
      intervalCallbacks.set(id, callback)
      createdIntervals.push({ id, ms })
      return id as unknown as ReturnType<typeof setInterval>
    }) as typeof setInterval

    // Mock clearInterval
    globalThis.clearInterval = ((id: ReturnType<typeof clearInterval>) => {
      clearedIntervals.push(id as unknown as number)
      intervalCallbacks.delete(id as unknown as number)
    }) as typeof clearInterval
  })

  afterEach(() => {
    globalThis.setInterval = originalSetInterval
    globalThis.clearInterval = originalClearInterval
  })

  test('creates interval with correct flush interval', () => {
    const updater = createBatchedMessageUpdater('ai-1', () => {}, 150)

    expect(createdIntervals).toHaveLength(1)
    expect(createdIntervals[0].ms).toBe(150)

    updater.dispose()
  })

  test('uses DEFAULT_FLUSH_INTERVAL_MS when not specified', () => {
    const updater = createBatchedMessageUpdater('ai-1', () => {})

    expect(createdIntervals).toHaveLength(1)
    expect(createdIntervals[0].ms).toBe(DEFAULT_FLUSH_INTERVAL_MS)

    updater.dispose()
  })

  test('auto-flush fires via interval callback', () => {
    let state = [...baseMessages]
    let flushCount = 0

    const updater = createBatchedMessageUpdater(
      'ai-1',
      (fn) => {
        flushCount++
        state = fn(state)
      },
      100,
    )

    // Queue an update
    updater.updateAiMessage((msg) => ({ ...msg, content: 'auto-flushed' }))

    // State should not have changed yet
    expect(flushCount).toBe(0)
    expect(state[0].content).toBe('')

    // Simulate the interval firing
    const intervalId = createdIntervals[0].id
    const callback = intervalCallbacks.get(intervalId)
    expect(callback).toBeDefined()
    callback!()

    // Now the update should be applied
    expect(flushCount).toBe(1)
    expect(state[0].content).toBe('auto-flushed')

    updater.dispose()
  })

  test('dispose clears the interval', () => {
    const updater = createBatchedMessageUpdater('ai-1', () => {}, 100)

    expect(createdIntervals).toHaveLength(1)
    const intervalId = createdIntervals[0].id

    updater.dispose()

    expect(clearedIntervals).toContain(intervalId)
  })

  test('markComplete clears the interval', () => {
    let state = [...baseMessages]
    const updater = createBatchedMessageUpdater(
      'ai-1',
      (fn) => {
        state = fn(state)
      },
      100,
    )

    const intervalId = createdIntervals[0].id

    updater.markComplete()

    expect(clearedIntervals).toContain(intervalId)
  })

  test('setError clears the interval', () => {
    let state = [...baseMessages]
    const updater = createBatchedMessageUpdater(
      'ai-1',
      (fn) => {
        state = fn(state)
      },
      100,
    )

    const intervalId = createdIntervals[0].id

    updater.setError('error message')

    expect(clearedIntervals).toContain(intervalId)
  })

  test('clearUserError applies immediately (bypasses batch queue)', () => {
    let state: ChatMessage[] = [
      {
        id: 'ai-1',
        variant: 'ai',
        content: 'content',
        userError: 'previous error',
        timestamp: 'now',
      },
    ]
    let setMessagesCallCount = 0

    const updater = createBatchedMessageUpdater(
      'ai-1',
      (fn) => {
        setMessagesCallCount++
        state = fn(state)
      },
      1000, // Long interval so it won't auto-flush
    )

    // Queue an update (should NOT be applied yet)
    updater.updateAiMessage((msg) => ({ ...msg, content: 'updated' }))
    expect(setMessagesCallCount).toBe(0)
    expect(state[0].content).toBe('content')

    // clearUserError should apply immediately
    updater.clearUserError()

    // Should have 1 call from clearUserError (applied immediately)
    expect(setMessagesCallCount).toBe(1)
    expect(state[0].userError).toBeUndefined()
    // Content should still be 'content' since the queued update wasn't flushed
    expect(state[0].content).toBe('content')

    updater.dispose()
  })

  test('clearUserError is a no-op if no userError exists', () => {
    let state: ChatMessage[] = [
      {
        id: 'ai-1',
        variant: 'ai',
        content: 'content',
        timestamp: 'now',
      },
    ]
    let setMessagesCallCount = 0

    const updater = createBatchedMessageUpdater(
      'ai-1',
      (fn) => {
        setMessagesCallCount++
        state = fn(state)
      },
      1000,
    )

    updater.clearUserError()

    // Should have 1 call but message unchanged
    expect(setMessagesCallCount).toBe(1)
    expect(state[0].userError).toBeUndefined()
    expect(state[0].content).toBe('content')

    updater.dispose()
  })

  test('no stray timers after all termination methods', () => {
    // Test that each termination method properly cleans up
    const updater1 = createBatchedMessageUpdater('ai-1', () => {}, 100)
    const updater2 = createBatchedMessageUpdater('ai-2', () => {}, 100)
    const updater3 = createBatchedMessageUpdater('ai-3', () => {}, 100)

    expect(createdIntervals).toHaveLength(3)

    updater1.dispose()
    updater2.markComplete()
    updater3.setError('error')

    // All 3 intervals should be cleared
    expect(clearedIntervals).toHaveLength(3)
    expect(intervalCallbacks.size).toBe(0)
  })
})

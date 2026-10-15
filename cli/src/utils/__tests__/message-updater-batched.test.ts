// Message-updater test family — createBatchedMessageUpdater queue/flush/
// dispose semantics. Sibling of the Loop-345 decomposition (parent:
// message-updater.test.ts; shared fixtures in
// ./message-updater-test-harness).
import { describe, expect, test } from 'bun:test'

import { createBatchedMessageUpdater } from '../message-updater'

import type { ChatMessage, TextContentBlock } from '../../types/chat'

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

describe('createBatchedMessageUpdater', () => {
  test('queues updates and does not apply immediately', () => {
    let state = [...baseMessages]
    let setMessagesCallCount = 0

    const updater = createBatchedMessageUpdater(
      'ai-1',
      (fn) => {
        setMessagesCallCount++
        state = fn(state)
      },
      1000, // Long interval so it won't auto-flush during test
    )

    // Queue several updates
    updater.updateAiMessage((msg) => ({ ...msg, content: 'first' }))
    updater.updateAiMessage((msg) => ({ ...msg, content: 'second' }))
    updater.updateAiMessage((msg) => ({ ...msg, content: 'third' }))

    // State should not have changed yet
    expect(state[0].content).toBe('')
    expect(setMessagesCallCount).toBe(0)

    // Clean up
    updater.dispose()
  })

  test('flush applies all queued updates in a single setMessages call', () => {
    let state = [...baseMessages]
    let setMessagesCallCount = 0

    const updater = createBatchedMessageUpdater(
      'ai-1',
      (fn) => {
        setMessagesCallCount++
        state = fn(state)
      },
      1000,
    )

    // Queue several updates
    updater.updateAiMessage((msg) => ({ ...msg, content: 'first' }))
    updater.updateAiMessageBlocks((blocks) => [
      ...blocks,
      { type: 'text', content: 'block1' },
    ])
    updater.addBlock({ type: 'text', content: 'block2' })

    // Manually flush
    updater.flush()

    // All updates should be applied in a single call
    expect(setMessagesCallCount).toBe(1)
    expect(state[0].content).toBe('first')
    expect(state[0].blocks).toHaveLength(2)
    expect((state[0].blocks![0] as TextContentBlock).content).toBe('block1')
    expect((state[0].blocks![1] as TextContentBlock).content).toBe('block2')

    updater.dispose()
  })

  test('markComplete flushes pending updates then applies completion', () => {
    let state = [...baseMessages]
    let setMessagesCallCount = 0

    const updater = createBatchedMessageUpdater(
      'ai-1',
      (fn) => {
        setMessagesCallCount++
        state = fn(state)
      },
      1000,
    )

    // Queue an update
    updater.updateAiMessage((msg) => ({ ...msg, content: 'updated' }))

    // markComplete should flush + apply completion
    updater.markComplete({ credits: 0.5 })

    // Should have 2 calls: flush + markComplete
    expect(setMessagesCallCount).toBe(2)
    expect(state[0].content).toBe('updated')
    expect(state[0].isComplete).toBe(true)
    expect(state[0].credits).toBe(0.5)
  })

  test('flush with empty queue does nothing', () => {
    let setMessagesCallCount = 0

    const updater = createBatchedMessageUpdater(
      'ai-1',
      () => {
        setMessagesCallCount++
      },
      1000,
    )

    // Flush with nothing queued
    updater.flush()

    expect(setMessagesCallCount).toBe(0)

    updater.dispose()
  })

  test('composes multiple updates in correct order', () => {
    let state = [...baseMessages]

    const updater = createBatchedMessageUpdater(
      'ai-1',
      (fn) => {
        state = fn(state)
      },
      1000,
    )

    // Queue updates that depend on order
    updater.updateAiMessage((msg) => ({ ...msg, content: 'a' }))
    updater.updateAiMessage((msg) => ({ ...msg, content: msg.content + 'b' }))
    updater.updateAiMessage((msg) => ({ ...msg, content: msg.content + 'c' }))

    updater.flush()

    // Should be composed in order
    expect(state[0].content).toBe('abc')

    updater.dispose()
  })

  test('calling dispose() multiple times is safe', () => {
    const updater = createBatchedMessageUpdater('ai-1', () => {}, 1000)

    // Should not throw when called multiple times
    updater.dispose()
    updater.dispose()
    updater.dispose()

    // Verify it's still in disposed state
    let callCount = 0
    const updater2 = createBatchedMessageUpdater(
      'ai-1',
      () => {
        callCount++
      },
      1000,
    )
    updater2.dispose()
    updater2.dispose()
    // Updates after dispose apply immediately
    updater2.updateAiMessage((msg) => msg)
    expect(callCount).toBe(1)
  })

  test('flush then queue more then flush again works correctly', () => {
    let state = [...baseMessages]
    let setMessagesCallCount = 0

    const updater = createBatchedMessageUpdater(
      'ai-1',
      (fn) => {
        setMessagesCallCount++
        state = fn(state)
      },
      1000,
    )

    // First batch
    updater.updateAiMessage((msg) => ({ ...msg, content: 'first' }))
    updater.flush()

    expect(setMessagesCallCount).toBe(1)
    expect(state[0].content).toBe('first')

    // Second batch
    updater.updateAiMessage((msg) => ({ ...msg, content: 'second' }))
    updater.addBlock({ type: 'text', content: 'block' })
    updater.flush()

    expect(setMessagesCallCount).toBe(2)
    expect(state[0].content).toBe('second')
    expect(state[0].blocks).toHaveLength(1)

    updater.dispose()
  })

  test('accepts and uses custom flush interval', () => {
    let flushCount = 0

    // Use a very short interval to verify it's respected
    const updater = createBatchedMessageUpdater(
      'ai-1',
      () => {
        flushCount++
      },
      10, // 10ms interval
    )

    // Queue an update
    updater.updateAiMessage((msg) => ({ ...msg, content: 'test' }))

    // Wait for auto-flush
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(flushCount).toBeGreaterThanOrEqual(1)
        updater.dispose()
        resolve()
      }, 50)
    })
  })
})

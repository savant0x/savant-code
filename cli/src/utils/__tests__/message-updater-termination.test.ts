// Message-updater test family — batched updater termination semantics:
// setError flush, dispose immediacy, and metadata preservation. Sibling of
// the Loop-345 decomposition (parent: message-updater.test.ts; shared
// fixtures in ./message-updater-test-harness).
import { describe, expect, test } from 'bun:test'

import { createBatchedMessageUpdater } from '../message-updater'

import type { TestMessageMetadata } from './message-updater-test-harness'
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
  test('setError flushes pending updates and preserves existing content and blocks', () => {
    let state: ChatMessage[] = [
      {
        id: 'ai-1',
        variant: 'ai',
        content: 'original content',
        blocks: [{ type: 'text', content: 'existing block' }],
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

    // Queue an update that should be flushed before applying the error
    updater.addBlock({ type: 'text', content: 'pending block' })

    updater.setError('something went wrong')

    // Should have 2 calls: flush + setError
    expect(setMessagesCallCount).toBe(2)
    // setError stores error in userError field, preserving content
    expect(state[0].content).toBe('original content')
    expect(state[0].userError).toBe('something went wrong')
    expect(state[0].isComplete).toBe(true)
    // Existing blocks are preserved and pending block was flushed
    expect(state[0].blocks).toHaveLength(2)
    expect((state[0].blocks![0] as TextContentBlock).content).toBe(
      'existing block',
    )
    expect((state[0].blocks![1] as TextContentBlock).content).toBe(
      'pending block',
    )
  })

  test('updates after dispose are applied immediately', () => {
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

    updater.dispose()

    // Updates after dispose should apply immediately
    updater.updateAiMessage((msg) => ({ ...msg, content: 'immediate' }))

    expect(setMessagesCallCount).toBe(1)
    expect(state[0].content).toBe('immediate')
  })

  test('markComplete preserves existing metadata', () => {
    const messagesWithMetadata: ChatMessage[] = [
      {
        id: 'ai-1',
        variant: 'ai',
        content: '',
        timestamp: 'now',
        metadata: { bashCwd: '/existing/path' },
      },
    ]
    let state = [...messagesWithMetadata]

    const updater = createBatchedMessageUpdater(
      'ai-1',
      (fn) => {
        state = fn(state)
      },
      1000,
    )

    updater.markComplete({ metadata: { runState: { id: 'run-123' } } })

    // Both existing and new metadata should be present
    expect(state[0].metadata?.bashCwd).toBe('/existing/path')
    expect((state[0].metadata as TestMessageMetadata)?.runState).toEqual({
      id: 'run-123',
    })
    expect(state[0].isComplete).toBe(true)
  })
})

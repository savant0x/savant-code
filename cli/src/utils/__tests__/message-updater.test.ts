// Message-updater test family — createMessageUpdater. Sibling of the
// Loop-345 decomposition (batched updater and timer behavior live in
// message-updater-*.test.ts siblings; shared fixtures in
// ./message-updater-test-harness).
import { describe, expect, test } from 'bun:test'

import { createMessageUpdater } from '../message-updater'

import type { TestMessageMetadata } from './message-updater-test-harness'
import type {
  ChatMessage,
  ContentBlock,
  TextContentBlock,
} from '../../types/chat'

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

describe('createMessageUpdater', () => {
  test('updates only the targeted AI message', () => {
    let state = [...baseMessages]
    const updater = createMessageUpdater('ai-1', (fn) => {
      state = fn(state)
    })

    updater.updateAiMessage((msg) => ({ ...msg, content: 'updated' }))

    expect(state[0].content).toBe('updated')
    expect(state[1].content).toBe('hi')
  })

  test('adds blocks and marks complete with metadata merge', () => {
    let state = [...baseMessages]

    const updater = createMessageUpdater('ai-1', (fn) => {
      state = fn(state)
    })

    const block: ContentBlock = { type: 'text', content: 'hello' }
    updater.addBlock(block)
    updater.markComplete({ metadata: { runState: { id: 'run-1' } } })

    expect(state[0].blocks?.[0]).toEqual(block)
    expect(state[0].isComplete).toBe(true)
    expect((state[0].metadata as TestMessageMetadata).runState).toEqual({
      id: 'run-1',
    })
  })

  test('setError preserves content and blocks, sets userError, and marks complete', () => {
    let state: ChatMessage[] = [
      {
        id: 'ai-1',
        variant: 'ai',
        content: 'original content',
        blocks: [{ type: 'text', content: 'existing block' }],
        timestamp: 'now',
      },
    ]

    const updater = createMessageUpdater('ai-1', (fn) => {
      state = fn(state)
    })

    updater.setError('boom')

    // setError stores error in userError field, preserving content
    expect(state[0].content).toBe('original content')
    expect(state[0].userError).toBe('boom')
    expect(state[0].isComplete).toBe(true)
    expect(state[0].blocks).toHaveLength(1)
    expect((state[0].blocks![0] as TextContentBlock).content).toBe(
      'existing block',
    )
  })

  test('clearUserError removes userError field from message', () => {
    let state: ChatMessage[] = [
      {
        id: 'ai-1',
        variant: 'ai',
        content: 'original content',
        userError: 'previous error',
        timestamp: 'now',
      },
    ]

    const updater = createMessageUpdater('ai-1', (fn) => {
      state = fn(state)
    })

    updater.clearUserError()

    expect(state[0].content).toBe('original content')
    expect(state[0].userError).toBeUndefined()
  })

  test('clearUserError is a no-op if no userError exists', () => {
    let state: ChatMessage[] = [
      {
        id: 'ai-1',
        variant: 'ai',
        content: 'original content',
        timestamp: 'now',
      },
    ]

    const updater = createMessageUpdater('ai-1', (fn) => {
      state = fn(state)
    })

    updater.clearUserError()

    expect(state[0].content).toBe('original content')
    expect(state[0].userError).toBeUndefined()
  })
})

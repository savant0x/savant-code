import { describe, expect, test } from 'bun:test'

import { buildMessageContext } from '../feedback-helpers'

import type { ChatMessage } from '../../types/chat'

const createMessage = (
  overrides: Partial<ChatMessage> & { id: string },
): ChatMessage => ({
  variant: 'ai',
  content: 'test content',
  timestamp: new Date().toISOString(),
  ...overrides,
})

describe('buildMessageContext', () => {
  test('returns target and recent messages for a valid target', () => {
    const messages = [
      createMessage({ id: 'msg-1', variant: 'user' }),
      createMessage({ id: 'msg-2', variant: 'ai' }),
      createMessage({ id: 'msg-3', variant: 'user' }),
    ]

    const result = buildMessageContext(messages, 'msg-2')

    expect(result.target).toBe(messages[1])
    expect(result.recentMessages).toHaveLength(2)
    expect(result.recentMessages[0]).toEqual({ type: 'user', id: 'msg-1' })
    expect(result.recentMessages[1]).toEqual({ type: 'ai', id: 'msg-2' })
  })

  test('returns null target and all messages when targetMessageId is null', () => {
    const messages = [
      createMessage({ id: 'msg-1' }),
      createMessage({ id: 'msg-2' }),
    ]

    const result = buildMessageContext(messages, null)

    expect(result.target).toBeNull()
    expect(result.recentMessages).toHaveLength(2)
  })

  test('returns null target and empty recentMessages when message ID is not found', () => {
    const messages = [
      createMessage({ id: 'msg-1' }),
      createMessage({ id: 'msg-2' }),
    ]

    const result = buildMessageContext(messages, 'nonexistent')

    expect(result.target).toBeNull()
    expect(result.recentMessages).toHaveLength(0)
  })

  test('limits to last 10 messages when targetMessageId is null', () => {
    const messages = Array.from({ length: 15 }, (_, i) =>
      createMessage({ id: `msg-${i}` }),
    )

    const result = buildMessageContext(messages, null)

    expect(result.recentMessages).toHaveLength(10)
    expect(result.recentMessages[0]).toMatchObject({ id: 'msg-5' })
    expect(result.recentMessages[9]).toMatchObject({ id: 'msg-14' })
  })

  test('includes credits: 0 in recent messages (not dropped)', () => {
    const messages = [
      createMessage({ id: 'msg-1', credits: 0 }),
      createMessage({ id: 'msg-2', credits: 5.5 }),
      createMessage({ id: 'msg-3' }),
    ]

    const result = buildMessageContext(messages, null)

    expect(result.recentMessages[0]).toEqual({
      type: 'ai',
      id: 'msg-1',
      credits: 0,
    })
    expect(result.recentMessages[1]).toEqual({
      type: 'ai',
      id: 'msg-2',
      credits: 5.5,
    })
    expect(result.recentMessages[2]).toEqual({ type: 'ai', id: 'msg-3' })
  })

  test('omits credits when undefined', () => {
    const messages = [createMessage({ id: 'msg-1' })]

    const result = buildMessageContext(messages, null)

    expect(result.recentMessages[0]).toEqual({ type: 'ai', id: 'msg-1' })
    expect('credits' in result.recentMessages[0]).toBe(false)
  })

  test('includes completionTime when present', () => {
    const messages = [createMessage({ id: 'msg-1', completionTime: '3.2s' })]

    const result = buildMessageContext(messages, null)

    expect(result.recentMessages[0]).toEqual({
      type: 'ai',
      id: 'msg-1',
      completionTime: '3.2s',
    })
  })

  test('includes empty string completionTime (not dropped by != null)', () => {
    const messages = [createMessage({ id: 'msg-1', completionTime: '' })]

    const result = buildMessageContext(messages, null)

    expect(result.recentMessages[0]).toEqual({
      type: 'ai',
      id: 'msg-1',
      completionTime: '',
    })
  })

  test('limits to last 10 messages up to target', () => {
    const messages = Array.from({ length: 15 }, (_, i) =>
      createMessage({ id: `msg-${i}` }),
    )

    const result = buildMessageContext(messages, 'msg-14')

    expect(result.recentMessages).toHaveLength(10)
    expect(result.recentMessages[0]).toMatchObject({ id: 'msg-5' })
    expect(result.recentMessages[9]).toMatchObject({ id: 'msg-14' })
  })

  test('returns all messages when fewer than 10 exist', () => {
    const messages = [
      createMessage({ id: 'msg-1' }),
      createMessage({ id: 'msg-2' }),
      createMessage({ id: 'msg-3' }),
    ]

    const result = buildMessageContext(messages, 'msg-3')

    expect(result.recentMessages).toHaveLength(3)
  })

  test('returns only target message when target is at index 0', () => {
    const messages = [
      createMessage({ id: 'msg-0' }),
      createMessage({ id: 'msg-1' }),
      createMessage({ id: 'msg-2' }),
    ]

    const result = buildMessageContext(messages, 'msg-0')

    expect(result.target).toBe(messages[0])
    expect(result.recentMessages).toHaveLength(1)
    expect(result.recentMessages[0]).toMatchObject({ id: 'msg-0' })
  })

  test('handles empty messages array', () => {
    const result = buildMessageContext([], null)

    expect(result.target).toBeNull()
    expect(result.recentMessages).toHaveLength(0)
  })
})

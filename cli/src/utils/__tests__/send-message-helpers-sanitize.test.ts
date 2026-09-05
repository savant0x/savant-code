import { describe, test, expect } from 'bun:test'

import {
  createModeDividerMessage,
  markMessageComplete,
  sanitizeRestoredMessages,
  setMessageError,
} from '../send-message-helpers'

import type {
  ContentBlock,
  AgentContentBlock,
  ChatMessage,
  TextContentBlock,
} from '../../types/chat'

// ============================================================================
// Message Completion Helpers Tests (from send-message-helpers)
// ============================================================================

describe('markMessageComplete', () => {
  const baseMessage: ChatMessage = {
    id: 'msg-1',
    variant: 'ai',
    content: 'Hello',
    timestamp: '',
  }

  test('marks message as complete', () => {
    const result = markMessageComplete(baseMessage)

    expect(result.isComplete).toBe(true)
  })

  test('adds completion time', () => {
    const result = markMessageComplete(baseMessage, { completionTime: '5s' })

    expect(result.completionTime).toBe('5s')
  })

  test('adds credits', () => {
    const result = markMessageComplete(baseMessage, { credits: 100 })

    expect(result.credits).toBe(100)
  })

  test('adds runState to metadata', () => {
    const runState = { output: { type: 'text', text: 'Done' } }
    const result = markMessageComplete(baseMessage, { runState })

    expect(result.metadata?.runState).toEqual(runState)
  })

  test('preserves existing metadata', () => {
    const message: ChatMessage = {
      ...baseMessage,
      metadata: { userOpened: true },
    }

    const result = markMessageComplete(message, { credits: 50 })

    expect(result.metadata?.userOpened).toBe(true)
  })
})

describe('setMessageError', () => {
  test('sets error content and clears blocks', () => {
    const message: ChatMessage = {
      id: 'msg-1',
      variant: 'ai',
      content: '',
      blocks: [{ type: 'text', content: 'Old content' }],
      timestamp: '',
    }

    const result = setMessageError(message, 'Error occurred')

    expect(result.content).toBe('Error occurred')
    expect(result.blocks).toBeUndefined()
    expect(result.isComplete).toBe(true)
  })
})

// ============================================================================
// sanitizeRestoredMessages Tests
// ============================================================================

describe('sanitizeRestoredMessages', () => {
  const streamedShell = (
    overrides: Partial<ChatMessage> = {},
  ): ChatMessage => ({
    id: 'ai-1750000000000-abc123',
    variant: 'ai',
    content: '',
    timestamp: new Date().toISOString(),
    blocks: [{ type: 'text', content: 'partial answer' }],
    ...overrides,
  })

  test('marks an interrupted AI response complete with an interruption notice', () => {
    const [result] = sanitizeRestoredMessages([streamedShell()])

    expect(result.isComplete).toBe(true)
    const lastBlock = result.blocks![result.blocks!.length - 1]
    expect(lastBlock.type).toBe('text')
    expect((lastBlock as TextContentBlock).content).toContain(
      '[response interrupted]',
    )
  })

  test('cancels running agent blocks in an interrupted AI response', () => {
    const [result] = sanitizeRestoredMessages([
      streamedShell({
        blocks: [
          {
            type: 'agent',
            agentId: 'agent-1',
            agentName: 'TestAgent',
            agentType: 'inline',
            content: '',
            status: 'running',
            blocks: [],
          },
        ],
      }),
    ])

    const agentBlock = result.blocks![0] as AgentContentBlock
    expect(agentBlock.status).toBe('cancelled')
  })

  test('adds a notice to an interrupted AI response with no blocks yet', () => {
    const [result] = sanitizeRestoredMessages([streamedShell({ blocks: [] })])

    expect(result.isComplete).toBe(true)
    expect(result.blocks).toHaveLength(1)
    expect((result.blocks![0] as TextContentBlock).content).toBe(
      '[response interrupted]',
    )
  })

  test('leaves completed AI responses untouched', () => {
    const message = streamedShell({ isComplete: true })
    const [result] = sanitizeRestoredMessages([message])

    expect(result).toBe(message)
  })

  test('strips the live inline-ad marker from restored responses', () => {
    const [result] = sanitizeRestoredMessages([
      streamedShell({
        isComplete: true,
        metadata: { allowInlineAds: true, userOpened: true },
      }),
    ])

    expect(result.metadata).toEqual({ userOpened: true })
  })

  test('leaves mode dividers, system messages, and user messages untouched', () => {
    const divider = createModeDividerMessage('HYBRID')
    const system: ChatMessage = {
      id: 'sys-123',
      variant: 'ai',
      content: 'system notice',
      timestamp: new Date().toISOString(),
    }
    const user: ChatMessage = {
      id: 'user-123',
      variant: 'user',
      content: 'hello',
      timestamp: new Date().toISOString(),
    }

    const results = sanitizeRestoredMessages([divider, system, user])

    expect(results[0]).toBe(divider)
    expect(results[1]).toBe(system)
    expect(results[2]).toBe(user)
  })
})

describe('sanitizeRestoredMessages corruption tolerance', () => {
  test('does not throw on null entries in a restored blocks array', () => {
    const corrupted: ChatMessage = {
      id: 'ai-1750000000000-abc123',
      variant: 'ai',
      content: '',
      timestamp: new Date().toISOString(),
      blocks: [null as unknown as ContentBlock, { type: 'text', content: 'x' }],
    }

    const [result] = sanitizeRestoredMessages([corrupted])

    expect(result.isComplete).toBe(true)
  })
})

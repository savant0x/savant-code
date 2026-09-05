import { describe, test, expect } from 'bun:test'

import { autoCollapseBlocks } from '../message-block-helpers'
import { autoCollapsePreviousMessages } from '../send-message-helpers'

import type {
  ContentBlock,
  AgentContentBlock,
  ChatMessage,
  TextContentBlock,
  ToolContentBlock,
} from '../../types/chat'

// ============================================================================
// Auto-Collapse Logic Tests
// ============================================================================

describe('autoCollapseBlocks', () => {
  test('collapses text blocks with thinkingId', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', content: 'thinking', thinkingId: 'think-1' },
    ]

    const result = autoCollapseBlocks(blocks)
    expect((result[0] as TextContentBlock).thinkingCollapseState).toBe('hidden')
  })

  test('does not collapse user-opened blocks', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'text',
        content: 'thinking',
        thinkingId: 'think-1',
        userOpened: true,
      },
    ]

    const result = autoCollapseBlocks(blocks)
    expect((result[0] as TextContentBlock).isCollapsed).toBeUndefined()
  })

  test('collapses agent blocks', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: '1',
        agentName: 'Test',
        agentType: 'test',
        content: '',
        status: 'running',
      },
    ]

    const result = autoCollapseBlocks(blocks)
    expect((result[0] as AgentContentBlock).isCollapsed).toBe(true)
  })

  test('collapses tool blocks', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        toolCallId: 'tool-1',
        toolName: 'read_files',
        input: {},
      },
    ]

    const result = autoCollapseBlocks(blocks)
    expect((result[0] as ToolContentBlock).isCollapsed).toBe(true)
  })

  test('recursively collapses nested agent blocks', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'parent',
        agentName: 'Parent',
        agentType: 'parent',
        content: '',
        status: 'running',
        blocks: [
          {
            type: 'agent',
            agentId: 'child',
            agentName: 'Child',
            agentType: 'child',
            content: '',
            status: 'running',
          },
        ],
      },
    ]

    const result = autoCollapseBlocks(blocks)
    const parent = result[0] as AgentContentBlock
    const child = parent.blocks![0] as AgentContentBlock

    expect(parent.isCollapsed).toBe(true)
    expect(child.isCollapsed).toBe(true)
  })
})

describe('autoCollapsePreviousMessages', () => {
  test('does not collapse the current AI message', () => {
    const messages: ChatMessage[] = [
      {
        id: 'ai-123',
        variant: 'ai',
        content: '',
        blocks: [
          {
            type: 'agent',
            agentId: '1',
            agentName: 'Test',
            agentType: 'test',
            content: '',
            status: 'running',
          },
        ],
        timestamp: '',
      },
    ]

    const result = autoCollapsePreviousMessages(messages, 'ai-123')
    expect(
      (result[0].blocks![0] as AgentContentBlock).isCollapsed,
    ).toBeUndefined()
  })

  test('collapses previous messages', () => {
    const messages: ChatMessage[] = [
      {
        id: 'ai-old',
        variant: 'ai',
        content: '',
        blocks: [
          {
            type: 'agent',
            agentId: '1',
            agentName: 'Test',
            agentType: 'test',
            content: '',
            status: 'running',
          },
        ],
        timestamp: '',
      },
      {
        id: 'ai-new',
        variant: 'ai',
        content: '',
        blocks: [],
        timestamp: '',
      },
    ]

    const result = autoCollapsePreviousMessages(messages, 'ai-new')
    expect((result[0].blocks![0] as AgentContentBlock).isCollapsed).toBe(true)
  })

  test('respects user-opened agent messages', () => {
    const messages: ChatMessage[] = [
      {
        id: 'agent-msg',
        variant: 'agent',
        content: '',
        timestamp: '',
        metadata: { userOpened: true },
      },
    ]

    const result = autoCollapsePreviousMessages(messages, 'ai-new')
    expect(result[0].metadata?.isCollapsed).toBeUndefined()
  })
})

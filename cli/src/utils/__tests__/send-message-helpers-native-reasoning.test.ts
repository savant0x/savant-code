import { describe, test, expect } from 'bun:test'

import {
  isNativeReasoningBlock,
  closeNativeReasoningBlock,
  closeNativeReasoningInAgent,
} from '../block-operations'

import type {
  ContentBlock,
  AgentContentBlock,
  TextContentBlock,
} from '../../types/chat'

// ============================================================================
// Native Reasoning Block Tests (from block-operations)
// ============================================================================

describe('isNativeReasoningBlock', () => {
  test('returns true for native reasoning block (thinkingOpen undefined)', () => {
    const block: ContentBlock = {
      type: 'text',
      content: 'Thinking...',
      textType: 'reasoning',
      isCollapsed: true,
      thinkingId: 'think-1',
    }

    expect(isNativeReasoningBlock(block)).toBe(true)
  })

  test('returns false for closed native reasoning block (thinkingOpen false)', () => {
    const block: ContentBlock = {
      type: 'text',
      content: 'Thinking...',
      textType: 'reasoning',
      isCollapsed: true,
      thinkingOpen: false,
      thinkingId: 'think-1',
    }

    expect(isNativeReasoningBlock(block)).toBe(false)
  })

  test('returns false for <think> tag block (thinkingOpen true)', () => {
    const block: ContentBlock = {
      type: 'text',
      content: 'Thinking...',
      textType: 'reasoning',
      isCollapsed: true,
      thinkingOpen: true,
      thinkingId: 'think-1',
    }

    expect(isNativeReasoningBlock(block)).toBe(false)
  })

  test('returns false for regular text block', () => {
    const block: ContentBlock = {
      type: 'text',
      content: 'Hello',
      textType: 'text',
    }

    expect(isNativeReasoningBlock(block)).toBe(false)
  })

  test('returns false for non-text blocks', () => {
    const agentBlock: ContentBlock = {
      type: 'agent',
      agentId: 'agent-1',
      agentName: 'Test',
      agentType: 'test',
      content: '',
      status: 'running',
    }

    expect(isNativeReasoningBlock(agentBlock)).toBe(false)
  })

  test('returns false for undefined', () => {
    expect(isNativeReasoningBlock(undefined)).toBe(false)
  })
})

describe('closeNativeReasoningBlock', () => {
  test('closes native reasoning block by setting thinkingOpen to false', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'text',
        content: 'Thinking...',
        textType: 'reasoning',
        isCollapsed: true,
        thinkingId: 'think-1',
      },
    ]

    const result = closeNativeReasoningBlock(blocks)

    expect(result).toHaveLength(1)
    expect((result[0] as TextContentBlock).thinkingOpen).toBe(false)
    expect((result[0] as TextContentBlock).content).toBe('Thinking...')
  })

  test('returns original blocks if no native reasoning block exists', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', content: 'Hello', textType: 'text' },
    ]

    const result = closeNativeReasoningBlock(blocks)

    expect(result).toBe(blocks) // Same reference
  })

  test('does not close already-closed reasoning blocks', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'text',
        content: 'Already closed',
        textType: 'reasoning',
        isCollapsed: true,
        thinkingOpen: false,
        thinkingId: 'think-1',
      },
    ]

    const result = closeNativeReasoningBlock(blocks)

    expect(result).toBe(blocks) // Same reference, no change
  })

  test('does not close <think> tag blocks (thinkingOpen true)', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'text',
        content: 'Think tag block',
        textType: 'reasoning',
        isCollapsed: true,
        thinkingOpen: true,
        thinkingId: 'think-1',
      },
    ]

    const result = closeNativeReasoningBlock(blocks)

    expect(result).toBe(blocks) // Same reference, no change
  })

  test('finds native reasoning block even when not at end', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'text',
        content: 'Native reasoning',
        textType: 'reasoning',
        isCollapsed: true,
        thinkingId: 'think-1',
      },
      {
        type: 'agent',
        agentId: 'agent-1',
        agentName: 'Test',
        agentType: 'test',
        content: '',
        status: 'running',
      },
    ]

    const result = closeNativeReasoningBlock(blocks)

    expect((result[0] as TextContentBlock).thinkingOpen).toBe(false)
    expect(result[1]).toEqual(blocks[1]) // Agent block unchanged
  })
})

describe('closeNativeReasoningInAgent', () => {
  test('closes native reasoning in specific agent', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'agent-1',
        agentName: 'Test',
        agentType: 'test',
        content: '',
        status: 'running',
        blocks: [
          {
            type: 'text',
            content: 'Agent thinking...',
            textType: 'reasoning',
            isCollapsed: true,
            thinkingId: 'think-1',
          },
        ],
      },
    ]

    const result = closeNativeReasoningInAgent(blocks, 'agent-1')

    const agentBlock = result[0] as AgentContentBlock
    expect((agentBlock.blocks![0] as TextContentBlock).thinkingOpen).toBe(false)
  })

  test('does not modify other agents', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'agent-1',
        agentName: 'Test 1',
        agentType: 'test',
        content: '',
        status: 'running',
        blocks: [
          {
            type: 'text',
            content: 'Agent 1 thinking...',
            textType: 'reasoning',
            isCollapsed: true,
            thinkingId: 'think-1',
          },
        ],
      },
      {
        type: 'agent',
        agentId: 'agent-2',
        agentName: 'Test 2',
        agentType: 'test',
        content: '',
        status: 'running',
        blocks: [
          {
            type: 'text',
            content: 'Agent 2 thinking...',
            textType: 'reasoning',
            isCollapsed: true,
            thinkingId: 'think-2',
          },
        ],
      },
    ]

    const result = closeNativeReasoningInAgent(blocks, 'agent-1')

    const agent1 = result[0] as AgentContentBlock
    const agent2 = result[1] as AgentContentBlock
    expect((agent1.blocks![0] as TextContentBlock).thinkingOpen).toBe(false)
    // Agent 2 should still have undefined thinkingOpen
    expect((agent2.blocks![0] as TextContentBlock).thinkingOpen).toBeUndefined()
  })

  test('returns original blocks if agent not found', () => {
    const blocks: ContentBlock[] = [{ type: 'text', content: 'Hello' }]

    const result = closeNativeReasoningInAgent(blocks, 'nonexistent')

    expect(result).toBe(blocks)
  })
})

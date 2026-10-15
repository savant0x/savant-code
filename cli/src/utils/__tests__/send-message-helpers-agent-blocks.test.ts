import { describe, test, expect } from 'bun:test'

import {
  appendTextToAgentBlock,
  appendToolToAgentBlock,
} from '../block-operations'

import type {
  ContentBlock,
  AgentContentBlock,
  TextContentBlock,
  ToolContentBlock,
} from '../../types/chat'

describe('appendTextToAgentBlock with native reasoning', () => {
  test('creates native reasoning block when textType is reasoning', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'agent-1',
        agentName: 'Test',
        agentType: 'test',
        content: '',
        status: 'running',
        blocks: [],
      },
    ]

    const result = appendTextToAgentBlock(
      blocks,
      'agent-1',
      'Thinking...',
      'reasoning',
    )

    const agentBlock = result[0] as AgentContentBlock
    expect(agentBlock.blocks).toHaveLength(1)
    expect((agentBlock.blocks![0] as TextContentBlock).textType).toBe(
      'reasoning',
    )
    expect((agentBlock.blocks![0] as TextContentBlock).content).toBe(
      'Thinking...',
    )
    expect(
      (agentBlock.blocks![0] as TextContentBlock).thinkingCollapseState,
    ).toBe('preview')
    // Native reasoning has thinkingOpen undefined
    expect(
      (agentBlock.blocks![0] as TextContentBlock).thinkingOpen,
    ).toBeUndefined()
  })

  test('appends to existing open native reasoning block', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'agent-1',
        agentName: 'Test',
        agentType: 'test',
        content: 'First',
        status: 'running',
        blocks: [
          {
            type: 'text',
            content: 'First',
            textType: 'reasoning',
            isCollapsed: true,
            thinkingId: 'think-1',
          },
        ],
      },
    ]

    const result = appendTextToAgentBlock(
      blocks,
      'agent-1',
      ' second',
      'reasoning',
    )

    const agentBlock = result[0] as AgentContentBlock
    expect(agentBlock.blocks).toHaveLength(1)
    expect((agentBlock.blocks![0] as TextContentBlock).content).toBe(
      'First second',
    )
  })

  test('does NOT append to closed native reasoning block', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'agent-1',
        agentName: 'Test',
        agentType: 'test',
        content: 'Closed',
        status: 'running',
        blocks: [
          {
            type: 'text',
            content: 'Closed',
            textType: 'reasoning',
            isCollapsed: true,
            thinkingOpen: false, // Already closed
            thinkingId: 'think-1',
          },
        ],
      },
    ]

    const result = appendTextToAgentBlock(
      blocks,
      'agent-1',
      'New thought',
      'reasoning',
    )

    const agentBlock = result[0] as AgentContentBlock
    // Should create a NEW reasoning block, not append to closed one
    expect(agentBlock.blocks).toHaveLength(2)
    expect((agentBlock.blocks![0] as TextContentBlock).content).toBe('Closed')
    expect((agentBlock.blocks![1] as TextContentBlock).content).toBe(
      'New thought',
    )
  })

  test('does NOT append to <think> tag block', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'agent-1',
        agentName: 'Test',
        agentType: 'test',
        content: 'Think tag',
        status: 'running',
        blocks: [
          {
            type: 'text',
            content: 'Think tag',
            textType: 'reasoning',
            isCollapsed: true,
            thinkingOpen: true, // <think> tag block
            thinkingId: 'think-1',
          },
        ],
      },
    ]

    const result = appendTextToAgentBlock(
      blocks,
      'agent-1',
      'Native thought',
      'reasoning',
    )

    const agentBlock = result[0] as AgentContentBlock
    // Should create a NEW native reasoning block, not append to <think> block
    expect(agentBlock.blocks).toHaveLength(2)
    expect((agentBlock.blocks![0] as TextContentBlock).thinkingOpen).toBe(true)
    expect(
      (agentBlock.blocks![1] as TextContentBlock).thinkingOpen,
    ).toBeUndefined()
  })

  test('closes native reasoning when regular text arrives', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'agent-1',
        agentName: 'Test',
        agentType: 'test',
        content: 'Thinking',
        status: 'running',
        blocks: [
          {
            type: 'text',
            content: 'Thinking',
            textType: 'reasoning',
            isCollapsed: true,
            thinkingId: 'think-1',
          },
        ],
      },
    ]

    const result = appendTextToAgentBlock(
      blocks,
      'agent-1',
      'Regular text',
      'text',
    )

    const agentBlock = result[0] as AgentContentBlock
    expect(agentBlock.blocks).toHaveLength(2)
    // Native reasoning should be closed
    expect((agentBlock.blocks![0] as TextContentBlock).thinkingOpen).toBe(false)
    // New text block added
    expect((agentBlock.blocks![1] as TextContentBlock).content).toBe(
      'Regular text',
    )
    expect((agentBlock.blocks![1] as TextContentBlock).textType).toBe('text')
  })
})

describe('appendToolToAgentBlock closes native reasoning', () => {
  test('closes native reasoning when tool is appended', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'agent-1',
        agentName: 'Test',
        agentType: 'test',
        content: 'Thinking',
        status: 'running',
        blocks: [
          {
            type: 'text',
            content: 'Thinking',
            textType: 'reasoning',
            isCollapsed: true,
            thinkingId: 'think-1',
          },
        ],
      },
    ]

    const toolBlock: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'tool-1',
      toolName: 'read_files',
      input: { paths: ['test.ts'] },
    }

    const result = appendToolToAgentBlock(blocks, 'agent-1', toolBlock)

    const agentBlock = result[0] as AgentContentBlock
    expect(agentBlock.blocks).toHaveLength(2)
    // Native reasoning should be closed
    expect((agentBlock.blocks![0] as TextContentBlock).thinkingOpen).toBe(false)
    // Tool block added
    expect(agentBlock.blocks![1].type).toBe('tool')
  })
})

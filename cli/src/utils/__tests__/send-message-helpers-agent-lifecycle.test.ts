import { describe, test, expect } from 'bun:test'

import {
  markAgentComplete,
  markRunningAgentsAsCancelled,
} from '../block-operations'

import type {
  ContentBlock,
  AgentContentBlock,
  TextContentBlock,
} from '../../types/chat'

describe('markAgentComplete closes native reasoning', () => {
  test('closes native reasoning when agent completes', () => {
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

    const result = markAgentComplete(blocks, 'agent-1')

    const agentBlock = result[0] as AgentContentBlock
    expect(agentBlock.status).toBe('complete')
    expect((agentBlock.blocks![0] as TextContentBlock).thinkingOpen).toBe(false)
  })
})

describe('markRunningAgentsAsCancelled closes native reasoning', () => {
  test('closes native reasoning in cancelled agents', () => {
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

    const result = markRunningAgentsAsCancelled(blocks)

    const agentBlock = result[0] as AgentContentBlock
    expect(agentBlock.status).toBe('cancelled')
    expect((agentBlock.blocks![0] as TextContentBlock).thinkingOpen).toBe(false)
  })

  test('closes native reasoning in nested cancelled agents', () => {
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
            content: 'Child thinking',
            status: 'running',
            blocks: [
              {
                type: 'text',
                content: 'Child thinking',
                textType: 'reasoning',
                isCollapsed: true,
                thinkingId: 'think-child',
              },
            ],
          },
        ],
      },
    ]

    const result = markRunningAgentsAsCancelled(blocks)

    const parentBlock = result[0] as AgentContentBlock
    const childBlock = parentBlock.blocks![0] as AgentContentBlock

    expect(parentBlock.status).toBe('cancelled')
    expect(childBlock.status).toBe('cancelled')
    expect((childBlock.blocks![0] as TextContentBlock).thinkingOpen).toBe(false)
  })

  test('closes native reasoning even in non-running agents during cancellation', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'agent-1',
        agentName: 'Test',
        agentType: 'test',
        content: '',
        status: 'complete', // Already complete
        blocks: [
          {
            type: 'agent',
            agentId: 'child',
            agentName: 'Child',
            agentType: 'child',
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
        ],
      },
    ]

    const result = markRunningAgentsAsCancelled(blocks)

    const parentBlock = result[0] as AgentContentBlock
    const childBlock = parentBlock.blocks![0] as AgentContentBlock

    // Parent stays complete
    expect(parentBlock.status).toBe('complete')
    // Child is cancelled
    expect(childBlock.status).toBe('cancelled')
    // Child's reasoning is closed
    expect((childBlock.blocks![0] as TextContentBlock).thinkingOpen).toBe(false)
  })

  test('does not modify agents without native reasoning blocks', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'agent-1',
        agentName: 'Test',
        agentType: 'test',
        content: 'Hello',
        status: 'running',
        blocks: [{ type: 'text', content: 'Hello', textType: 'text' }],
      },
    ]

    const result = markRunningAgentsAsCancelled(blocks)

    const agentBlock = result[0] as AgentContentBlock
    expect(agentBlock.status).toBe('cancelled')
    // Text block should be unchanged
    expect(
      (agentBlock.blocks![0] as TextContentBlock).thinkingOpen,
    ).toBeUndefined()
  })
})

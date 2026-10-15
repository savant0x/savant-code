// Message-block-helpers test family — recursive tree edits:
// updateBlocksRecursively and nestBlockUnderParent. Sibling of the Loop 319
// decomposition (moveSpawnAgentBlock has its own module).

import { describe, expect, test } from 'bun:test'

import {
  updateBlocksRecursively,
  nestBlockUnderParent,
} from '../message-block-helpers'

import type { AgentContentBlock, ContentBlock } from '../../types/chat'

describe('updateBlocksRecursively', () => {
  test('updates target block at top level', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'agent-1',
        agentName: 'Test',
        agentType: 'test',
        content: '',
        status: 'running',
        blocks: [],
        initialPrompt: '',
      },
    ]
    const result = updateBlocksRecursively(blocks, 'agent-1', (block) => ({
      ...block,
      status: 'complete' as const,
    }))
    expect((result[0] as AgentContentBlock).status).toBe('complete')
  })

  test('updates nested block', () => {
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
            blocks: [],
            initialPrompt: '',
          },
        ],
        initialPrompt: '',
      },
    ]
    const result = updateBlocksRecursively(blocks, 'child', (block) => ({
      ...block,
      status: 'complete' as const,
    }))
    expect((result[0] as AgentContentBlock).blocks![0]).toMatchObject({
      status: 'complete',
    })
  })

  test('returns original array if target not found', () => {
    const blocks: ContentBlock[] = [{ type: 'text', content: 'Hello' }]
    const result = updateBlocksRecursively(
      blocks,
      'nonexistent',
      (block) => block,
    )
    expect(result).toBe(blocks)
  })

  test('handles deeply nested blocks', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'level-1',
        agentName: 'L1',
        agentType: 'l1',
        content: '',
        status: 'running',
        blocks: [
          {
            type: 'agent',
            agentId: 'level-2',
            agentName: 'L2',
            agentType: 'l2',
            content: '',
            status: 'running',
            blocks: [
              {
                type: 'agent',
                agentId: 'level-3',
                agentName: 'L3',
                agentType: 'l3',
                content: '',
                status: 'running',
                blocks: [],
                initialPrompt: '',
              },
            ],
            initialPrompt: '',
          },
        ],
        initialPrompt: '',
      },
    ]
    const result = updateBlocksRecursively(blocks, 'level-3', (block) => ({
      ...block,
      content: 'updated',
    }))
    const level1 = result[0] as AgentContentBlock
    const level2 = level1.blocks![0] as AgentContentBlock
    const level3 = level2.blocks![0] as AgentContentBlock
    expect(level3.content).toBe('updated')
  })
})

describe('nestBlockUnderParent', () => {
  test('nests block under existing parent', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'parent',
        agentName: 'Parent',
        agentType: 'parent',
        content: '',
        status: 'running',
        blocks: [],
        initialPrompt: '',
      },
    ]
    const childBlock: ContentBlock = { type: 'text', content: 'Child content' }
    const { blocks: result, parentFound } = nestBlockUnderParent(
      blocks,
      'parent',
      childBlock,
    )
    expect(parentFound).toBe(true)
    expect((result[0] as AgentContentBlock).blocks).toHaveLength(1)
    expect((result[0] as AgentContentBlock).blocks![0]).toEqual(childBlock)
  })

  test('returns parentFound false when parent not found', () => {
    const blocks: ContentBlock[] = [{ type: 'text', content: 'Hello' }]
    const childBlock: ContentBlock = { type: 'text', content: 'Child' }
    const { blocks: result, parentFound } = nestBlockUnderParent(
      blocks,
      'nonexistent',
      childBlock,
    )
    expect(parentFound).toBe(false)
    expect(result).toBe(blocks)
  })

  test('appends to existing blocks in parent', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'parent',
        agentName: 'Parent',
        agentType: 'parent',
        content: '',
        status: 'running',
        blocks: [{ type: 'text', content: 'Existing' }],
        initialPrompt: '',
      },
    ]
    const childBlock: ContentBlock = { type: 'text', content: 'New child' }
    const { blocks: result, parentFound } = nestBlockUnderParent(
      blocks,
      'parent',
      childBlock,
    )
    expect(parentFound).toBe(true)
    expect((result[0] as AgentContentBlock).blocks).toHaveLength(2)
    expect((result[0] as AgentContentBlock).blocks![1]).toEqual(childBlock)
  })

  test('nests under deeply nested parent', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'grandparent',
        agentName: 'GP',
        agentType: 'gp',
        content: '',
        status: 'running',
        blocks: [
          {
            type: 'agent',
            agentId: 'parent',
            agentName: 'Parent',
            agentType: 'parent',
            content: '',
            status: 'running',
            blocks: [],
            initialPrompt: '',
          },
        ],
        initialPrompt: '',
      },
    ]
    const childBlock: ContentBlock = { type: 'text', content: 'Nested child' }
    const { blocks: result, parentFound } = nestBlockUnderParent(
      blocks,
      'parent',
      childBlock,
    )
    expect(parentFound).toBe(true)
    const grandparent = result[0] as AgentContentBlock
    const parent = grandparent.blocks![0] as AgentContentBlock
    expect(parent.blocks).toHaveLength(1)
    expect(parent.blocks![0]).toEqual(childBlock)
  })
})

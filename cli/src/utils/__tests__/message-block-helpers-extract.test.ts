// Message-block-helpers test family — extractBlockById. Sibling of the
// Loop 319 decomposition.

import { describe, expect, test } from 'bun:test'

import { extractBlockById } from '../message-block-helpers'

import type {
  AgentContentBlock,
  ContentBlock,
  TextContentBlock,
} from '../../types/chat'

describe('extractBlockById', () => {
  test('extracts block from top level', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', content: 'Keep me' },
      {
        type: 'agent',
        agentId: 'extract-me',
        agentName: 'Extract',
        agentType: 'extract',
        content: '',
        status: 'running',
        blocks: [],
        initialPrompt: '',
      },
    ]
    const { remainingBlocks, extractedBlock } = extractBlockById(
      blocks,
      'extract-me',
    )
    expect(remainingBlocks).toHaveLength(1)
    expect(remainingBlocks[0].type).toBe('text')
    expect(extractedBlock).not.toBeNull()
    expect((extractedBlock as AgentContentBlock).agentId).toBe('extract-me')
  })

  test('returns null when block not found', () => {
    const blocks: ContentBlock[] = [{ type: 'text', content: 'Hello' }]
    const { remainingBlocks, extractedBlock } = extractBlockById(
      blocks,
      'nonexistent',
    )
    expect(remainingBlocks).toHaveLength(1)
    expect(extractedBlock).toBeNull()
  })

  test('extracts from nested blocks', () => {
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
            agentId: 'nested-child',
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
    const { remainingBlocks, extractedBlock } = extractBlockById(
      blocks,
      'nested-child',
    )
    expect((remainingBlocks[0] as AgentContentBlock).blocks).toHaveLength(0)
    expect(extractedBlock).not.toBeNull()
    expect((extractedBlock as AgentContentBlock).agentId).toBe('nested-child')
  })

  test('handles empty blocks array', () => {
    const { remainingBlocks, extractedBlock } = extractBlockById([], 'any-id')
    expect(remainingBlocks).toHaveLength(0)
    expect(extractedBlock).toBeNull()
  })

  test('preserves non-matching nested structure', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'parent',
        agentName: 'Parent',
        agentType: 'parent',
        content: '',
        status: 'running',
        blocks: [
          { type: 'text', content: 'Keep this' },
          {
            type: 'agent',
            agentId: 'extract-me',
            agentName: 'Extract',
            agentType: 'extract',
            content: '',
            status: 'running',
            blocks: [],
            initialPrompt: '',
          },
          { type: 'text', content: 'Keep this too' },
        ],
        initialPrompt: '',
      },
    ]
    const { remainingBlocks, extractedBlock } = extractBlockById(
      blocks,
      'extract-me',
    )
    const parentBlock = remainingBlocks[0] as AgentContentBlock
    expect(parentBlock.blocks).toHaveLength(2)
    expect((parentBlock.blocks![0] as TextContentBlock).content).toBe(
      'Keep this',
    )
    expect((parentBlock.blocks![1] as TextContentBlock).content).toBe(
      'Keep this too',
    )
    expect(extractedBlock).not.toBeNull()
  })
})

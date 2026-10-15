import { describe, test, expect } from 'bun:test'

import {
  updateBlocksRecursively,
  scrubPlanTags,
  scrubPlanTagsInBlocks,
} from '../message-block-helpers'

import type {
  ContentBlock,
  AgentContentBlock,
  TextContentBlock,
} from '../../types/chat'

// ============================================================================
// Block Manipulation Helpers Tests (from message-block-helpers)
// ============================================================================

describe('updateBlocksRecursively', () => {
  test('updates a top-level agent block', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'agent-1',
        agentName: 'Test',
        agentType: 'test',
        content: '',
        status: 'running',
      },
    ]

    const result = updateBlocksRecursively(blocks, 'agent-1', (block) => ({
      ...block,
      status: 'complete' as const,
    }))

    expect(result[0].type).toBe('agent')
    expect((result[0] as AgentContentBlock).status).toBe('complete')
  })

  test('updates a nested agent block', () => {
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

    const result = updateBlocksRecursively(blocks, 'child', (block) => ({
      ...block,
      status: 'complete' as const,
    }))

    const parent = result[0] as AgentContentBlock
    const child = parent.blocks![0] as AgentContentBlock
    expect(child.status).toBe('complete')
  })

  test('returns original array if no match found', () => {
    const blocks: ContentBlock[] = [{ type: 'text', content: 'Hello' }]

    const result = updateBlocksRecursively(blocks, 'nonexistent', (block) => ({
      ...block,
    }))

    expect(result).toBe(blocks) // Same reference
  })

  test('does not create new blocks for unchanged nested structures', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'agent-1',
        agentName: 'Test',
        agentType: 'test',
        content: '',
        status: 'running',
        blocks: [{ type: 'text', content: 'Nested text' }],
      },
    ]

    const result = updateBlocksRecursively(blocks, 'nonexistent', (block) => ({
      ...block,
    }))

    expect(result).toBe(blocks)
  })
})

describe('scrubPlanTags', () => {
  test('removes complete PLAN tags', () => {
    const input = 'Before <PLAN>plan content</cb_plan> After'
    expect(scrubPlanTags(input)).toBe('Before  After')
  })

  test('removes incomplete trailing PLAN tags', () => {
    const input = 'Content <PLAN>incomplete plan'
    expect(scrubPlanTags(input)).toBe('Content ')
  })

  test('handles string with no PLAN tags', () => {
    const input = 'Just regular content'
    expect(scrubPlanTags(input)).toBe('Just regular content')
  })

  test('handles empty string', () => {
    expect(scrubPlanTags('')).toBe('')
  })
})

describe('scrubPlanTagsInBlocks', () => {
  test('removes plan tags from text blocks', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', content: 'Hello <PLAN>plan</cb_plan> World' },
    ]

    const result = scrubPlanTagsInBlocks(blocks)
    expect((result[0] as TextContentBlock).content).toBe('Hello  World')
  })

  test('filters out empty text blocks after scrubbing', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', content: '<PLAN>only plan</cb_plan>' },
      { type: 'text', content: 'Keep this' },
    ]

    const result = scrubPlanTagsInBlocks(blocks)
    expect(result).toHaveLength(1)
    expect((result[0] as TextContentBlock).content).toBe('Keep this')
  })

  test('preserves non-text blocks', () => {
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

    const result = scrubPlanTagsInBlocks(blocks)
    expect(result).toEqual(blocks)
  })
})

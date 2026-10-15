// Message-block-helpers test family — appendInterruptionNotice and
// createAgentBlock. Sibling of the Loop 319 decomposition.

import { describe, expect, test } from 'bun:test'

import {
  appendInterruptionNotice,
  createAgentBlock,
} from '../message-block-helpers'

import type { ContentBlock } from '../../types/chat'

describe('appendInterruptionNotice', () => {
  test('appends to last text block', () => {
    const blocks: ContentBlock[] = [{ type: 'text', content: 'Hello' }]
    const result = appendInterruptionNotice(blocks)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      type: 'text',
      content: 'Hello\n\n[response interrupted]',
    })
  })

  test('preserves text block fields when appending', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'text',
        content: 'Hello',
        color: 'blue',
        status: 'running',
        thinkingId: 'think-1',
        userOpened: true,
        thinkingCollapseState: 'hidden',
      },
    ]
    const result = appendInterruptionNotice(blocks)
    expect(result[0]).toMatchObject({
      color: 'blue',
      status: 'running',
      thinkingId: 'think-1',
      userOpened: true,
      thinkingCollapseState: 'hidden',
      content: 'Hello\n\n[response interrupted]',
    })
  })

  test('adds new block when last is not text', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        toolCallId: 'tool-1',
        toolName: 'read_files',
        input: {},
      },
    ]
    const result = appendInterruptionNotice(blocks)
    expect(result).toHaveLength(2)
    expect(result[1]).toEqual({
      type: 'text',
      content: '[response interrupted]',
    })
  })

  test('adds notice to empty blocks array', () => {
    const result = appendInterruptionNotice([])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      type: 'text',
      content: '[response interrupted]',
    })
  })

  test('preserves other blocks when appending to text', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        toolCallId: 'tool-1',
        toolName: 'read_files',
        input: {},
      },
      { type: 'text', content: 'Some response' },
    ]
    const result = appendInterruptionNotice(blocks)
    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('tool')
    expect(result[1]).toEqual({
      type: 'text',
      content: 'Some response\n\n[response interrupted]',
    })
  })
})

describe('createAgentBlock', () => {
  test('creates basic agent block with required fields', () => {
    const block = createAgentBlock({
      agentId: 'agent-123',
      agentType: 'scout',
    })
    expect(block.type).toBe('agent')
    expect(block.agentId).toBe('agent-123')
    expect(block.agentName).toBe('scout')
    expect(block.agentType).toBe('scout')
    expect(block.content).toBe('')
    expect(block.status).toBe('running')
    expect(block.blocks).toEqual([])
    expect(block.initialPrompt).toBe('')
  })

  test('includes prompt when provided', () => {
    const block = createAgentBlock({
      agentId: 'agent-123',
      agentType: 'scout',
      prompt: 'Find relevant files',
    })
    expect(block.initialPrompt).toBe('Find relevant files')
  })

  test('includes params when provided', () => {
    const block = createAgentBlock({
      agentId: 'agent-123',
      agentType: 'scout',
      params: { directories: ['src'] },
    })
    expect(block.params).toEqual({ directories: ['src'] })
  })

  test('uses fallback values for empty agentType', () => {
    const block = createAgentBlock({
      agentId: 'agent-123',
      agentType: '',
    })
    expect(block.agentName).toBe('Agent')
    expect(block.agentType).toBe('unknown')
  })
})

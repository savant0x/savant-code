import { describe, expect, test } from 'bun:test'

import {
  groupConsecutiveBlocks,
  groupConsecutiveToolBlocks,
} from '../implementor-helpers'

import type {
  AgentContentBlock,
  ContentBlock,
  TextContentBlock,
  ToolContentBlock,
} from '../../types/chat'

describe('groupConsecutiveBlocks', () => {
  const createTextBlock = (content: string): TextContentBlock =>
    ({
      type: 'text',
      content,
    }) as TextContentBlock

  const createToolBlock = (toolName: string): ToolContentBlock => ({
    type: 'tool',
    toolCallId: `tool-${toolName}`,
    toolName: toolName as ToolContentBlock['toolName'],
    input: {},
  })

  const _createAgentBlock = (
    agentType: string,
    agentId: string,
  ): AgentContentBlock =>
    ({
      type: 'agent',
      agentId,
      agentName: agentType,
      agentType,
      content: '',
      status: 'complete',
      blocks: [],
    }) as AgentContentBlock

  test('groups consecutive matching blocks from start', () => {
    const blocks: ContentBlock[] = [
      createTextBlock('text1'),
      createTextBlock('text2'),
      createToolBlock('str_replace'),
    ]
    const isText = (b: ContentBlock): b is TextContentBlock => b.type === 'text'
    const result = groupConsecutiveBlocks(blocks, 0, isText)

    expect(result.group).toHaveLength(2)
    expect(result.group[0].content).toBe('text1')
    expect(result.group[1].content).toBe('text2')
    expect(result.nextIndex).toBe(2)
  })

  test('groups from middle of array', () => {
    const blocks: ContentBlock[] = [
      createToolBlock('read_files'),
      createTextBlock('text1'),
      createTextBlock('text2'),
      createTextBlock('text3'),
      createToolBlock('write_file'),
    ]
    const isText = (b: ContentBlock): b is TextContentBlock => b.type === 'text'
    const result = groupConsecutiveBlocks(blocks, 1, isText)

    expect(result.group).toHaveLength(3)
    expect(result.nextIndex).toBe(4)
  })

  test('returns empty group when first block does not match', () => {
    const blocks: ContentBlock[] = [
      createToolBlock('str_replace'),
      createTextBlock('text1'),
    ]
    const isText = (b: ContentBlock): b is TextContentBlock => b.type === 'text'
    const result = groupConsecutiveBlocks(blocks, 0, isText)

    expect(result.group).toHaveLength(0)
    expect(result.nextIndex).toBe(0)
  })

  test('handles empty blocks array', () => {
    const blocks: ContentBlock[] = []
    const isText = (b: ContentBlock): b is TextContentBlock => b.type === 'text'
    const result = groupConsecutiveBlocks(blocks, 0, isText)

    expect(result.group).toHaveLength(0)
    expect(result.nextIndex).toBe(0)
  })

  test('handles startIndex at end of array', () => {
    const blocks: ContentBlock[] = [createTextBlock('text1')]
    const isText = (b: ContentBlock): b is TextContentBlock => b.type === 'text'
    const result = groupConsecutiveBlocks(blocks, 1, isText)

    expect(result.group).toHaveLength(0)
    expect(result.nextIndex).toBe(1)
  })

  test('handles startIndex beyond array length', () => {
    const blocks: ContentBlock[] = [createTextBlock('text1')]
    const isText = (b: ContentBlock): b is TextContentBlock => b.type === 'text'
    const result = groupConsecutiveBlocks(blocks, 10, isText)

    expect(result.group).toHaveLength(0)
    expect(result.nextIndex).toBe(10)
  })

  test('groups all blocks when all match', () => {
    const blocks: ContentBlock[] = [
      createTextBlock('text1'),
      createTextBlock('text2'),
      createTextBlock('text3'),
    ]
    const isText = (b: ContentBlock): b is TextContentBlock => b.type === 'text'
    const result = groupConsecutiveBlocks(blocks, 0, isText)

    expect(result.group).toHaveLength(3)
    expect(result.nextIndex).toBe(3)
  })

  test('groups single matching block', () => {
    const blocks: ContentBlock[] = [
      createTextBlock('text1'),
      createToolBlock('str_replace'),
    ]
    const isText = (b: ContentBlock): b is TextContentBlock => b.type === 'text'
    const result = groupConsecutiveBlocks(blocks, 0, isText)

    expect(result.group).toHaveLength(1)
    expect(result.nextIndex).toBe(1)
  })

  test('works with complex predicates', () => {
    const blocks: ContentBlock[] = [
      createToolBlock('str_replace'),
      createToolBlock('write_file'),
      createToolBlock('read_files'),
      createTextBlock('done'),
    ]
    const isEditTool = (b: ContentBlock): b is ToolContentBlock =>
      b.type === 'tool' &&
      ['str_replace', 'write_file'].includes(b.toolName as string)
    const result = groupConsecutiveBlocks(blocks, 0, isEditTool)

    expect(result.group).toHaveLength(2)
    expect(result.group[0].toolName).toBe('str_replace')
    expect(result.group[1].toolName).toBe('write_file')
    expect(result.nextIndex).toBe(2)
  })
})

describe('groupConsecutiveToolBlocks', () => {
  const createToolBlock = (toolName: string, id: string): ToolContentBlock => ({
    type: 'tool',
    toolCallId: id,
    toolName: toolName as ToolContentBlock['toolName'],
    input: {},
  })

  const createTextBlock = (content: string): TextContentBlock =>
    ({
      type: 'text',
      content,
    }) as TextContentBlock

  const createAgentBlock = (id: string): AgentContentBlock =>
    ({
      type: 'agent',
      agentId: id,
      agentName: 'Test Agent',
      agentType: 'scout',
      content: '',
      status: 'complete',
      blocks: [],
    }) as AgentContentBlock

  test('groups consecutive tool blocks', () => {
    const blocks: ContentBlock[] = [
      createToolBlock('str_replace', 'tool-1'),
      createToolBlock('write_file', 'tool-2'),
      createToolBlock('read_files', 'tool-3'),
      createTextBlock('done'),
    ]
    const result = groupConsecutiveToolBlocks(blocks, 0)

    expect(result.group).toHaveLength(3)
    expect(result.group[0].toolCallId).toBe('tool-1')
    expect(result.group[1].toolCallId).toBe('tool-2')
    expect(result.group[2].toolCallId).toBe('tool-3')
    expect(result.nextIndex).toBe(3)
  })

  test('stops at non-tool block', () => {
    const blocks: ContentBlock[] = [
      createToolBlock('str_replace', 'tool-1'),
      createTextBlock('some text'),
      createToolBlock('write_file', 'tool-2'),
    ]
    const result = groupConsecutiveToolBlocks(blocks, 0)

    expect(result.group).toHaveLength(1)
    expect(result.nextIndex).toBe(1)
  })

  test('stops at agent block', () => {
    const blocks: ContentBlock[] = [
      createToolBlock('str_replace', 'tool-1'),
      createAgentBlock('agent-1'),
      createToolBlock('write_file', 'tool-2'),
    ]
    const result = groupConsecutiveToolBlocks(blocks, 0)

    expect(result.group).toHaveLength(1)
    expect(result.nextIndex).toBe(1)
  })

  test('returns empty group when starting at non-tool block', () => {
    const blocks: ContentBlock[] = [
      createTextBlock('some text'),
      createToolBlock('str_replace', 'tool-1'),
    ]
    const result = groupConsecutiveToolBlocks(blocks, 0)

    expect(result.group).toHaveLength(0)
    expect(result.nextIndex).toBe(0)
  })

  test('groups from middle of array', () => {
    const blocks: ContentBlock[] = [
      createTextBlock('start'),
      createToolBlock('str_replace', 'tool-1'),
      createToolBlock('write_file', 'tool-2'),
      createTextBlock('end'),
    ]
    const result = groupConsecutiveToolBlocks(blocks, 1)

    expect(result.group).toHaveLength(2)
    expect(result.group[0].toolCallId).toBe('tool-1')
    expect(result.group[1].toolCallId).toBe('tool-2')
    expect(result.nextIndex).toBe(3)
  })

  test('handles empty blocks array', () => {
    const result = groupConsecutiveToolBlocks([], 0)
    expect(result.group).toHaveLength(0)
    expect(result.nextIndex).toBe(0)
  })

  test('groups all tool blocks when all match', () => {
    const blocks: ContentBlock[] = [
      createToolBlock('str_replace', 'tool-1'),
      createToolBlock('write_file', 'tool-2'),
      createToolBlock('read_files', 'tool-3'),
    ]
    const result = groupConsecutiveToolBlocks(blocks, 0)

    expect(result.group).toHaveLength(3)
    expect(result.nextIndex).toBe(3)
  })

  test('handles single tool block', () => {
    const blocks: ContentBlock[] = [
      createToolBlock('str_replace', 'tool-1'),
      createTextBlock('done'),
    ]
    const result = groupConsecutiveToolBlocks(blocks, 0)

    expect(result.group).toHaveLength(1)
    expect(result.nextIndex).toBe(1)
  })
})

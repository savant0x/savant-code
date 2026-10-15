// Message-block-helpers test family — autoCollapseBlocks. Sibling of the
// Loop 319 decomposition.

import { describe, expect, test } from 'bun:test'

import { autoCollapseBlocks } from '../message-block-helpers'

import type { AgentContentBlock, ContentBlock } from '../../types/chat'

describe('autoCollapseBlocks', () => {
  test('collapses text blocks with thinkingId', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', content: 'thinking', thinkingId: 'think-1' },
    ]
    const result = autoCollapseBlocks(blocks)
    expect(result[0]).toHaveProperty('thinkingCollapseState', 'hidden')
  })

  test('preserves user-opened text blocks', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'text',
        content: 'thinking',
        thinkingId: 'think-1',
        userOpened: true,
      },
    ]
    const result = autoCollapseBlocks(blocks)
    expect(result[0]).not.toHaveProperty('isCollapsed')
  })

  test('collapses agent blocks', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'agent-1',
        agentName: 'Test Agent',
        agentType: 'test',
        content: '',
        status: 'complete',
        blocks: [],
        initialPrompt: '',
      },
    ]
    const result = autoCollapseBlocks(blocks)
    expect(result[0]).toHaveProperty('isCollapsed', true)
  })

  test('recursively collapses nested agent blocks', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'parent',
        agentName: 'Parent',
        agentType: 'parent',
        content: '',
        status: 'complete',
        blocks: [
          {
            type: 'agent',
            agentId: 'child',
            agentName: 'Child',
            agentType: 'child',
            content: '',
            status: 'complete',
            blocks: [],
            initialPrompt: '',
          },
        ],
        initialPrompt: '',
      },
    ]
    const result = autoCollapseBlocks(blocks)
    expect(result[0]).toHaveProperty('isCollapsed', true)
    expect((result[0] as AgentContentBlock).blocks![0]).toHaveProperty(
      'isCollapsed',
      true,
    )
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
    expect(result[0]).toHaveProperty('isCollapsed', true)
  })

  test('preserves user-opened tool blocks', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        toolCallId: 'tool-1',
        toolName: 'read_files',
        input: {},
        userOpened: true,
      },
    ]
    const result = autoCollapseBlocks(blocks)
    expect(result[0]).not.toHaveProperty('isCollapsed')
  })

  test('leaves regular text blocks unchanged', () => {
    const blocks: ContentBlock[] = [{ type: 'text', content: 'Hello' }]
    const result = autoCollapseBlocks(blocks)
    expect(result[0]).toEqual({ type: 'text', content: 'Hello' })
  })
})

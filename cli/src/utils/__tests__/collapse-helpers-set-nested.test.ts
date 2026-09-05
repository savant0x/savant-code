// Collapse-helpers test family — setAllBlocksCollapsedState on nested and
// mixed structures. Sibling of the Loop 318 decomposition.

import { describe, test, expect } from 'bun:test'

import {
  createAgentBlock,
  createAgentListBlock,
  createMessage,
  createTextBlock,
  createThinkingBlock,
  createToolBlock,
  setAllBlocksCollapsedState,
  type CollapsibleBlock,
} from './collapse-helpers-test-fixtures'

import type {
  AgentContentBlock,
  ContentBlock,
  TextContentBlock,
} from '../../types/chat'

describe('setAllBlocksCollapsedState — nested and mixed', () => {
  describe('agent blocks', () => {
    test('collapses agent blocks', () => {
      const messages = [
        createMessage('1', 'ai', [createAgentBlock('agent-1', false)]),
      ]
      const result = setAllBlocksCollapsedState(messages, true)

      const block = result[0]?.blocks?.[0] as CollapsibleBlock
      expect(block?.isCollapsed).toBe(true)
    })

    test('expands agent blocks and sets userOpened', () => {
      const messages = [
        createMessage('1', 'ai', [createAgentBlock('agent-1', true)]),
      ]
      const result = setAllBlocksCollapsedState(messages, false)

      const block = result[0]?.blocks?.[0] as CollapsibleBlock
      expect(block?.isCollapsed).toBe(false)
      expect(block?.userOpened).toBe(true)
    })

    test('handles nested blocks within agent blocks', () => {
      const nestedBlocks = [
        createToolBlock('nested-tool-1', false),
        createToolBlock('nested-tool-2', false),
      ]
      const messages = [
        createMessage('1', 'ai', [
          createAgentBlock('agent-1', false, false, nestedBlocks),
        ]),
      ]
      const result = setAllBlocksCollapsedState(messages, true)

      const agentBlock = result[0]?.blocks?.[0] as AgentContentBlock
      const nestedBlocksResult = agentBlock?.blocks as CollapsibleBlock[]
      expect(nestedBlocksResult?.[0]?.isCollapsed).toBe(true)
      expect(nestedBlocksResult?.[1]?.isCollapsed).toBe(true)
    })

    test('handles deeply nested agent blocks', () => {
      const deepNestedBlocks = [createToolBlock('deep-tool', false)]
      const nestedAgentBlocks = [
        createAgentBlock('nested-agent', false, false, deepNestedBlocks),
      ]
      const messages = [
        createMessage('1', 'ai', [
          createAgentBlock('agent-1', false, false, nestedAgentBlocks),
        ]),
      ]
      const result = setAllBlocksCollapsedState(messages, true)

      const outerAgent = result[0]?.blocks?.[0] as AgentContentBlock
      expect(outerAgent?.isCollapsed).toBe(true)

      const innerAgent = outerAgent?.blocks?.[0] as AgentContentBlock
      expect(innerAgent?.isCollapsed).toBe(true)

      const deepBlock = innerAgent?.blocks?.[0] as CollapsibleBlock
      expect(deepBlock?.isCollapsed).toBe(true)
    })
  })

  describe('mixed block types', () => {
    test('collapses all block types together', () => {
      const messages = [
        createMessage('1', 'ai', [
          createToolBlock('tool-1', false),
          createAgentBlock('agent-1', false),
          createThinkingBlock('think-1', 'expanded'),
          createAgentListBlock('list-1', false),
          createTextBlock('regular text'),
        ]),
      ]
      const result = setAllBlocksCollapsedState(messages, true)

      const blocks = result[0]?.blocks as CollapsibleBlock[]
      expect(blocks[0]?.isCollapsed).toBe(true) // tool
      expect(blocks[1]?.isCollapsed).toBe(true) // agent
      expect((blocks[2] as TextContentBlock)?.thinkingCollapseState).toBe(
        'hidden',
      ) // thinking
      expect(blocks[3]?.isCollapsed).toBe(true) // agent-list
      expect((blocks[4] as TextContentBlock)?.isCollapsed).toBeUndefined() // text (not collapsible)
    })

    test('expands all block types together', () => {
      const messages = [
        createMessage('1', 'ai', [
          createToolBlock('tool-1', true),
          createAgentBlock('agent-1', true),
          createThinkingBlock('think-1', 'hidden'),
          createAgentListBlock('list-1', true),
        ]),
      ]
      const result = setAllBlocksCollapsedState(messages, false)

      const blocks = result[0]?.blocks as CollapsibleBlock[]
      expect(blocks[0]?.isCollapsed).toBe(false)
      expect(blocks[0]?.userOpened).toBe(true)
      expect(blocks[1]?.isCollapsed).toBe(false)
      expect(blocks[1]?.userOpened).toBe(true)
      expect((blocks[2] as TextContentBlock)?.thinkingCollapseState).toBe(
        'expanded',
      )
      expect((blocks[2] as TextContentBlock)?.userOpened).toBe(true)
      expect(blocks[3]?.isCollapsed).toBe(false)
      expect(blocks[3]?.userOpened).toBe(true)
    })
  })

  describe('multiple messages', () => {
    test('collapses blocks across multiple messages', () => {
      const messages = [
        createMessage('1', 'ai', [createToolBlock('tool-1', false)]),
        createMessage('2', 'ai', [createAgentBlock('agent-1', false)]),
        createMessage('3', 'agent', undefined, { isCollapsed: false }),
      ]
      const result = setAllBlocksCollapsedState(messages, true)

      expect((result[0]?.blocks?.[0] as CollapsibleBlock)?.isCollapsed).toBe(
        true,
      )
      expect((result[1]?.blocks?.[0] as CollapsibleBlock)?.isCollapsed).toBe(
        true,
      )
      expect(result[2]?.metadata?.isCollapsed).toBe(true)
    })

    test('expands blocks across multiple messages', () => {
      const messages = [
        createMessage('1', 'ai', [createToolBlock('tool-1', true)]),
        createMessage('2', 'ai', [createAgentBlock('agent-1', true)]),
        createMessage('3', 'agent', undefined, { isCollapsed: true }),
      ]
      const result = setAllBlocksCollapsedState(messages, false)

      expect((result[0]?.blocks?.[0] as CollapsibleBlock)?.isCollapsed).toBe(
        false,
      )
      expect((result[1]?.blocks?.[0] as CollapsibleBlock)?.isCollapsed).toBe(
        false,
      )
      expect(result[2]?.metadata?.isCollapsed).toBe(false)
    })

    test('only modifies messages with collapsible content', () => {
      const messages = [
        createMessage('1', 'user'),
        createMessage('2', 'ai', [createToolBlock('tool-1', false)]),
        createMessage('3', 'ai', [createTextBlock('regular text')]),
      ]
      const result = setAllBlocksCollapsedState(messages, true)

      // User message unchanged
      expect(result[0]).toBe(messages[0])
      // Tool block message changed
      expect(result[1]).not.toBe(messages[1])
      expect((result[1]?.blocks?.[0] as CollapsibleBlock)?.isCollapsed).toBe(
        true,
      )
      // Text-only message unchanged
      expect(result[2]).toBe(messages[2])
    })
  })

  describe('userOpened behavior', () => {
    test('sets userOpened to true when expanding', () => {
      const messages = [
        createMessage('1', 'ai', [createToolBlock('tool-1', true, false)]),
      ]
      const result = setAllBlocksCollapsedState(messages, false)

      const block = result[0]?.blocks?.[0] as CollapsibleBlock
      expect(block?.userOpened).toBe(true)
    })

    test('preserves existing userOpened when collapsing', () => {
      const messages = [
        createMessage('1', 'ai', [createToolBlock('tool-1', false, true)]),
      ]
      const result = setAllBlocksCollapsedState(messages, true)

      const block = result[0]?.blocks?.[0] as CollapsibleBlock
      expect(block?.userOpened).toBe(true)
    })

    test('handles undefined userOpened when collapsing', () => {
      const messages = [
        createMessage('1', 'ai', [createToolBlock('tool-1', false)]),
      ]
      const result = setAllBlocksCollapsedState(messages, true)

      const block = result[0]?.blocks?.[0] as CollapsibleBlock
      expect(block?.userOpened).toBeUndefined()
    })
  })

  describe('reference preservation (optimization)', () => {
    test('preserves message reference when no changes needed', () => {
      const messages = [
        createMessage('1', 'ai', [createToolBlock('tool-1', true)]),
      ]
      const result = setAllBlocksCollapsedState(messages, true)

      expect(result[0]).toBe(messages[0])
    })

    test('preserves blocks array reference when no nested changes', () => {
      const messages = [
        createMessage('1', 'ai', [createTextBlock('no change needed')]),
      ]
      const result = setAllBlocksCollapsedState(messages, true)

      expect(result[0]?.blocks).toBe(messages[0]?.blocks)
    })
  })

  describe('edge cases', () => {
    test('handles undefined blocks in agent block', () => {
      const agentBlock = createAgentBlock('agent-1', false)
      delete (agentBlock as { blocks?: ContentBlock[] }).blocks

      const messages = [createMessage('1', 'ai', [agentBlock])]
      const result = setAllBlocksCollapsedState(messages, true)

      expect((result[0]?.blocks?.[0] as CollapsibleBlock)?.isCollapsed).toBe(
        true,
      )
    })

    test('handles empty blocks array', () => {
      const messages = [createMessage('1', 'ai', [])]
      const result = setAllBlocksCollapsedState(messages, true)

      expect(result[0]).toBe(messages[0])
    })

    test('handles message with undefined metadata for agent variant when collapsing', () => {
      const message = createMessage('1', 'agent')
      delete message.metadata

      const result = setAllBlocksCollapsedState([message], true)

      // undefined metadata is treated as collapsed, so no change should be made
      expect(result[0]).toBe(message)
    })

    test('handles message with undefined metadata for agent variant when expanding', () => {
      const message = createMessage('1', 'agent')
      delete message.metadata

      const result = setAllBlocksCollapsedState([message], false)

      // undefined metadata is treated as collapsed, so expand should work
      expect(result[0]?.metadata?.isCollapsed).toBe(false)
      expect(result[0]?.metadata?.userOpened).toBe(true)
    })
  })
})

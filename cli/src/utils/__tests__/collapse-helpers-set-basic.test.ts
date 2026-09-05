// Collapse-helpers test family — setAllBlocksCollapsedState on single-block
// and message-level structures. Sibling of the Loop 318 decomposition.

import { describe, test, expect } from 'bun:test'

import {
  createAgentListBlock,
  createMessage,
  createTextBlock,
  createThinkingBlock,
  createToolBlock,
  setAllBlocksCollapsedState,
  type CollapsibleBlock,
} from './collapse-helpers-test-fixtures'

import type { TextContentBlock } from '../../types/chat'

describe('setAllBlocksCollapsedState — basic and agent variant', () => {
  describe('empty and basic cases', () => {
    test('returns empty array for empty messages', () => {
      const result = setAllBlocksCollapsedState([], true)
      expect(result).toEqual([])
    })

    test('returns messages unchanged when no collapsible content', () => {
      const messages = [
        createMessage('1', 'user'),
        createMessage('2', 'ai', [createTextBlock('hello')]),
      ]
      const result = setAllBlocksCollapsedState(messages, true)
      expect(result).toEqual(messages)
    })

    test('returns messages unchanged when no blocks', () => {
      const messages = [createMessage('1', 'ai')]
      const result = setAllBlocksCollapsedState(messages, true)
      expect(result).toEqual(messages)
    })
  })

  describe('agent variant messages', () => {
    test('collapses agent variant message', () => {
      const messages = [
        createMessage('1', 'agent', undefined, { isCollapsed: false }),
      ]
      const result = setAllBlocksCollapsedState(messages, true)

      expect(result[0]?.metadata?.isCollapsed).toBe(true)
    })

    test('expands agent variant message', () => {
      const messages = [
        createMessage('1', 'agent', undefined, { isCollapsed: true }),
      ]
      const result = setAllBlocksCollapsedState(messages, false)

      expect(result[0]?.metadata?.isCollapsed).toBe(false)
      expect(result[0]?.metadata?.userOpened).toBe(true)
    })

    test('does not modify already collapsed agent variant message', () => {
      const messages = [
        createMessage('1', 'agent', undefined, { isCollapsed: true }),
      ]
      const result = setAllBlocksCollapsedState(messages, true)

      // Should return same reference when no change needed
      expect(result[0]).toBe(messages[0])
    })

    test('does not modify already expanded agent variant message', () => {
      const messages = [
        createMessage('1', 'agent', undefined, { isCollapsed: false }),
      ]
      const result = setAllBlocksCollapsedState(messages, false)

      expect(result[0]).toBe(messages[0])
    })

    test('handles agent variant message with undefined isCollapsed when collapsing', () => {
      const messages = [createMessage('1', 'agent')]
      const result = setAllBlocksCollapsedState(messages, true)

      // undefined is treated as collapsed, so no change should be made
      expect(result[0]).toBe(messages[0])
    })

    test('expands agent variant message with undefined isCollapsed', () => {
      const messages = [createMessage('1', 'agent')]
      const result = setAllBlocksCollapsedState(messages, false)

      // undefined is treated as collapsed, so expand should work
      expect(result[0]?.metadata?.isCollapsed).toBe(false)
      expect(result[0]?.metadata?.userOpened).toBe(true)
    })
  })

  describe('tool blocks', () => {
    test('collapses all tool blocks', () => {
      const messages = [
        createMessage('1', 'ai', [
          createToolBlock('tool-1', false),
          createToolBlock('tool-2', false),
        ]),
      ]
      const result = setAllBlocksCollapsedState(messages, true)

      const blocks = result[0]?.blocks as CollapsibleBlock[]
      expect(blocks[0]?.isCollapsed).toBe(true)
      expect(blocks[1]?.isCollapsed).toBe(true)
    })

    test('expands all tool blocks', () => {
      const messages = [
        createMessage('1', 'ai', [
          createToolBlock('tool-1', true),
          createToolBlock('tool-2', true),
        ]),
      ]
      const result = setAllBlocksCollapsedState(messages, false)

      const blocks = result[0]?.blocks as CollapsibleBlock[]
      expect(blocks[0]?.isCollapsed).toBe(false)
      expect(blocks[0]?.userOpened).toBe(true)
      expect(blocks[1]?.isCollapsed).toBe(false)
      expect(blocks[1]?.userOpened).toBe(true)
    })

    test('handles mixed collapsed states', () => {
      const messages = [
        createMessage('1', 'ai', [
          createToolBlock('tool-1', true),
          createToolBlock('tool-2', false),
        ]),
      ]
      const result = setAllBlocksCollapsedState(messages, true)

      const blocks = result[0]?.blocks as CollapsibleBlock[]
      expect(blocks[0]?.isCollapsed).toBe(true)
      expect(blocks[1]?.isCollapsed).toBe(true)
    })

    test('expands tool blocks with undefined isCollapsed', () => {
      const messages = [createMessage('1', 'ai', [createToolBlock('tool-1')])]
      const result = setAllBlocksCollapsedState(messages, false)

      // undefined is treated as collapsed, so expand should work
      const block = result[0]?.blocks?.[0] as CollapsibleBlock
      expect(block?.isCollapsed).toBe(false)
      expect(block?.userOpened).toBe(true)
    })

    test('does not modify tool block with undefined isCollapsed when collapsing', () => {
      const messages = [createMessage('1', 'ai', [createToolBlock('tool-1')])]
      const result = setAllBlocksCollapsedState(messages, true)

      // undefined is treated as collapsed, so no change should be made
      expect(result[0]).toBe(messages[0])
    })
  })

  describe('thinking blocks', () => {
    test('collapses thinking blocks', () => {
      const messages = [
        createMessage('1', 'ai', [createThinkingBlock('think-1', 'expanded')]),
      ]
      const result = setAllBlocksCollapsedState(messages, true)

      const block = result[0]?.blocks?.[0] as TextContentBlock
      expect(block?.thinkingCollapseState).toBe('hidden')
    })

    test('expands thinking blocks and sets userOpened', () => {
      const messages = [
        createMessage('1', 'ai', [createThinkingBlock('think-1', 'hidden')]),
      ]
      const result = setAllBlocksCollapsedState(messages, false)

      const block = result[0]?.blocks?.[0] as TextContentBlock
      expect(block?.thinkingCollapseState).toBe('expanded')
      expect(block?.userOpened).toBe(true)
    })

    test('does not collapse text blocks without thinkingId', () => {
      const messages = [
        createMessage('1', 'ai', [createTextBlock('regular text')]),
      ]
      const result = setAllBlocksCollapsedState(messages, true)

      // Should return same reference since no change
      expect(result[0]).toBe(messages[0])
    })
  })

  describe('agent-list blocks', () => {
    test('collapses agent-list blocks', () => {
      const messages = [
        createMessage('1', 'ai', [createAgentListBlock('list-1', false)]),
      ]
      const result = setAllBlocksCollapsedState(messages, true)

      const block = result[0]?.blocks?.[0] as CollapsibleBlock
      expect(block?.isCollapsed).toBe(true)
    })

    test('expands agent-list blocks and sets userOpened', () => {
      const messages = [
        createMessage('1', 'ai', [createAgentListBlock('list-1', true)]),
      ]
      const result = setAllBlocksCollapsedState(messages, false)

      const block = result[0]?.blocks?.[0] as CollapsibleBlock
      expect(block?.isCollapsed).toBe(false)
      expect(block?.userOpened).toBe(true)
    })
  })
})

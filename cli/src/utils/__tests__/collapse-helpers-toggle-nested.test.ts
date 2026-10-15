// Collapse-helpers test family — toggle-all edge cases: nested mixed states,
// deep structures, non-collapsible neighbors, and agent-variant messages
// carrying blocks. Sibling of the Loop 318 decomposition.

import { describe, test, expect } from 'bun:test'

import {
  createAgentBlock,
  createMessage,
  createTextBlock,
  createThinkingBlock,
  createToolBlock,
  hasAnyExpandedBlocks,
  setAllBlocksCollapsedState,
  type CollapsibleBlock,
} from './collapse-helpers-test-fixtures'

import type { AgentContentBlock, TextContentBlock } from '../../types/chat'

describe('toggle-all edge cases — nested and deep', () => {
  describe('nested agent blocks with mixed collapsed states', () => {
    test('hasAnyExpandedBlocks: collapsed parent with expanded child returns true', () => {
      const nestedBlocks = [createToolBlock('tool-1', false)] // expanded
      const messages = [
        createMessage('1', 'ai', [
          createAgentBlock('agent-1', true, false, nestedBlocks),
        ]), // collapsed parent
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(true)
    })

    test('hasAnyExpandedBlocks: expanded parent with collapsed child returns true', () => {
      const nestedBlocks = [createToolBlock('tool-1', true)] // collapsed
      const messages = [
        createMessage('1', 'ai', [
          createAgentBlock('agent-1', false, false, nestedBlocks),
        ]), // expanded parent
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(true)
    })

    test('hasAnyExpandedBlocks: expanded parent with expanded child returns true', () => {
      const nestedBlocks = [createToolBlock('tool-1', false)] // expanded
      const messages = [
        createMessage('1', 'ai', [
          createAgentBlock('agent-1', false, false, nestedBlocks),
        ]), // expanded parent
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(true)
    })

    test('hasAnyExpandedBlocks: collapsed parent with collapsed child returns false', () => {
      const nestedBlocks = [createToolBlock('tool-1', true)] // collapsed
      const messages = [
        createMessage('1', 'ai', [
          createAgentBlock('agent-1', true, false, nestedBlocks),
        ]), // collapsed parent
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(false)
    })

    test('hasAnyExpandedBlocks: collapsed parent with mixed nested states returns true', () => {
      const nestedBlocks = [
        createToolBlock('tool-1', true), // collapsed
        createToolBlock('tool-2', false), // expanded
        createToolBlock('tool-3', true), // collapsed
      ]
      const messages = [
        createMessage('1', 'ai', [
          createAgentBlock('agent-1', true, false, nestedBlocks),
        ]),
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(true)
    })

    test('setAllBlocksCollapsedState: collapses both parent and nested blocks', () => {
      const nestedBlocks = [
        createToolBlock('tool-1', false),
        createThinkingBlock('think-1', 'expanded'),
      ]
      const messages = [
        createMessage('1', 'ai', [
          createAgentBlock('agent-1', false, false, nestedBlocks),
        ]),
      ]
      const result = setAllBlocksCollapsedState(messages, true)

      const agentBlock = result[0]?.blocks?.[0] as AgentContentBlock
      expect(agentBlock?.isCollapsed).toBe(true)
      expect((agentBlock?.blocks?.[0] as CollapsibleBlock)?.isCollapsed).toBe(
        true,
      )
      expect(
        (agentBlock?.blocks?.[1] as TextContentBlock)?.thinkingCollapseState,
      ).toBe('hidden')
    })

    test('setAllBlocksCollapsedState: expands both parent and nested blocks', () => {
      const nestedBlocks = [
        createToolBlock('tool-1', true),
        createThinkingBlock('think-1', 'hidden'),
      ]
      const messages = [
        createMessage('1', 'ai', [
          createAgentBlock('agent-1', true, false, nestedBlocks),
        ]),
      ]
      const result = setAllBlocksCollapsedState(messages, false)

      const agentBlock = result[0]?.blocks?.[0] as AgentContentBlock
      expect(agentBlock?.isCollapsed).toBe(false)
      expect(agentBlock?.userOpened).toBe(true)
      expect((agentBlock?.blocks?.[0] as CollapsibleBlock)?.isCollapsed).toBe(
        false,
      )
      expect((agentBlock?.blocks?.[0] as CollapsibleBlock)?.userOpened).toBe(
        true,
      )
      expect(
        (agentBlock?.blocks?.[1] as TextContentBlock)?.thinkingCollapseState,
      ).toBe('expanded')
      expect((agentBlock?.blocks?.[1] as TextContentBlock)?.userOpened).toBe(
        true,
      )
    })
  })

  describe('deeply nested structures (3+ levels)', () => {
    test('hasAnyExpandedBlocks: finds expanded block at level 3', () => {
      const level3Blocks = [createToolBlock('deep-tool', false)] // expanded at level 3
      const level2Blocks = [
        createAgentBlock('level2-agent', true, false, level3Blocks),
      ] // collapsed at level 2
      const level1Blocks = [
        createAgentBlock('level1-agent', true, false, level2Blocks),
      ] // collapsed at level 1
      const messages = [createMessage('1', 'ai', level1Blocks)]

      expect(hasAnyExpandedBlocks(messages)).toBe(true)
    })

    test('hasAnyExpandedBlocks: all collapsed at 3 levels returns false', () => {
      const level3Blocks = [createToolBlock('deep-tool', true)] // collapsed at level 3
      const level2Blocks = [
        createAgentBlock('level2-agent', true, false, level3Blocks),
      ] // collapsed at level 2
      const level1Blocks = [
        createAgentBlock('level1-agent', true, false, level2Blocks),
      ] // collapsed at level 1
      const messages = [createMessage('1', 'ai', level1Blocks)]

      expect(hasAnyExpandedBlocks(messages)).toBe(false)
    })

    test('setAllBlocksCollapsedState: collapses all 3 levels', () => {
      const level3Blocks = [createToolBlock('deep-tool', false)] // expanded
      const level2Blocks = [
        createAgentBlock('level2-agent', false, false, level3Blocks),
      ] // expanded
      const level1Blocks = [
        createAgentBlock('level1-agent', false, false, level2Blocks),
      ] // expanded
      const messages = [createMessage('1', 'ai', level1Blocks)]

      const result = setAllBlocksCollapsedState(messages, true)

      const level1 = result[0]?.blocks?.[0] as AgentContentBlock
      expect(level1?.isCollapsed).toBe(true)

      const level2 = level1?.blocks?.[0] as AgentContentBlock
      expect(level2?.isCollapsed).toBe(true)

      const level3 = level2?.blocks?.[0] as CollapsibleBlock
      expect(level3?.isCollapsed).toBe(true)
    })

    test('setAllBlocksCollapsedState: expands all 3 levels with undefined states', () => {
      // All undefined (treated as collapsed)
      const level3Blocks = [createToolBlock('deep-tool')]
      const level2Blocks = [
        createAgentBlock('level2-agent', undefined, undefined, level3Blocks),
      ]
      const level1Blocks = [
        createAgentBlock('level1-agent', undefined, undefined, level2Blocks),
      ]
      const messages = [createMessage('1', 'ai', level1Blocks)]

      const result = setAllBlocksCollapsedState(messages, false)

      const level1 = result[0]?.blocks?.[0] as AgentContentBlock
      expect(level1?.isCollapsed).toBe(false)
      expect(level1?.userOpened).toBe(true)

      const level2 = level1?.blocks?.[0] as AgentContentBlock
      expect(level2?.isCollapsed).toBe(false)
      expect(level2?.userOpened).toBe(true)

      const level3 = level2?.blocks?.[0] as CollapsibleBlock
      expect(level3?.isCollapsed).toBe(false)
      expect(level3?.userOpened).toBe(true)
    })
  })

  describe('mixed collapsible and non-collapsible blocks', () => {
    test('hasAnyExpandedBlocks: ignores non-collapsible text blocks when checking', () => {
      const nestedBlocks = [
        createTextBlock('regular text'), // not collapsible
        createToolBlock('tool-1', true), // collapsed
      ]
      const messages = [
        createMessage('1', 'ai', [
          createAgentBlock('agent-1', true, false, nestedBlocks),
        ]),
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(false)
    })

    test('hasAnyExpandedBlocks: finds expanded block among non-collapsible blocks', () => {
      const nestedBlocks = [
        createTextBlock('regular text 1'), // not collapsible
        createToolBlock('tool-1', false), // expanded
        createTextBlock('regular text 2'), // not collapsible
      ]
      const messages = [
        createMessage('1', 'ai', [
          createAgentBlock('agent-1', true, false, nestedBlocks),
        ]),
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(true)
    })

    test('setAllBlocksCollapsedState: preserves non-collapsible blocks in nested structure', () => {
      const nestedBlocks = [
        createTextBlock('regular text'),
        createToolBlock('tool-1', false),
      ]
      const messages = [
        createMessage('1', 'ai', [
          createAgentBlock('agent-1', false, false, nestedBlocks),
        ]),
      ]
      const result = setAllBlocksCollapsedState(messages, true)

      const agentBlock = result[0]?.blocks?.[0] as AgentContentBlock
      expect(agentBlock?.blocks?.[0]?.type).toBe('text')
      expect((agentBlock?.blocks?.[0] as TextContentBlock)?.content).toBe(
        'regular text',
      )
      expect(
        (agentBlock?.blocks?.[0] as CollapsibleBlock)?.isCollapsed,
      ).toBeUndefined()
      expect((agentBlock?.blocks?.[1] as CollapsibleBlock)?.isCollapsed).toBe(
        true,
      )
    })
  })
})

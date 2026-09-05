// Collapse-helpers test family — toggle workflows (hasAnyExpandedBlocks +
// setAllBlocksCollapsedState composed) and empty/edge nested structures.
// Sibling of the Loop 318 decomposition.

import { describe, test, expect } from 'bun:test'

import {
  createAgentBlock,
  createAgentListBlock,
  createMessage,
  createThinkingBlock,
  createToolBlock,
  hasAnyExpandedBlocks,
  setAllBlocksCollapsedState,
  type CollapsibleBlock,
} from './collapse-helpers-test-fixtures'

import type { AgentContentBlock, TextContentBlock } from '../../types/chat'

describe('toggle-all edge cases — workflows and edge structures', () => {
  describe('toggle-all workflow (hasAnyExpandedBlocks + setAllBlocksCollapsedState)', () => {
    test('toggle: when any expanded, collapse all', () => {
      const messages = [
        createMessage('1', 'ai', [
          createToolBlock('tool-1', true), // collapsed
          createToolBlock('tool-2', false), // expanded
        ]),
      ]

      // First: check if any are expanded
      const hasExpanded = hasAnyExpandedBlocks(messages)
      expect(hasExpanded).toBe(true)

      // Then: collapse all (since some are expanded)
      const result = setAllBlocksCollapsedState(messages, true)

      // Verify all are now collapsed
      expect(hasAnyExpandedBlocks(result)).toBe(false)
      expect((result[0]?.blocks?.[0] as CollapsibleBlock)?.isCollapsed).toBe(
        true,
      )
      expect((result[0]?.blocks?.[1] as CollapsibleBlock)?.isCollapsed).toBe(
        true,
      )
    })

    test('toggle: when all collapsed, expand all', () => {
      const messages = [
        createMessage('1', 'ai', [
          createToolBlock('tool-1', true), // collapsed
          createToolBlock('tool-2', true), // collapsed
        ]),
      ]

      // First: check if any are expanded
      const hasExpanded = hasAnyExpandedBlocks(messages)
      expect(hasExpanded).toBe(false)

      // Then: expand all (since none are expanded)
      const result = setAllBlocksCollapsedState(messages, false)

      // Verify all are now expanded
      expect(hasAnyExpandedBlocks(result)).toBe(true)
      expect((result[0]?.blocks?.[0] as CollapsibleBlock)?.isCollapsed).toBe(
        false,
      )
      expect((result[0]?.blocks?.[1] as CollapsibleBlock)?.isCollapsed).toBe(
        false,
      )
    })

    test('toggle: fresh session with undefined states expands all', () => {
      // Simulates first Ctrl+T on fresh session
      const messages = [
        createMessage('1', 'ai', [
          createToolBlock('tool-1'), // undefined = collapsed
          createAgentBlock('agent-1'), // undefined = collapsed
        ]),
      ]

      // Check if any expanded (should be false since undefined = collapsed)
      const hasExpanded = hasAnyExpandedBlocks(messages)
      expect(hasExpanded).toBe(false)

      // Expand all since none are expanded
      const result = setAllBlocksCollapsedState(messages, false)

      // Verify all are now expanded
      expect(hasAnyExpandedBlocks(result)).toBe(true)
    })

    test('toggle: double-toggle returns to expanded state', () => {
      const messages = [
        createMessage('1', 'ai', [createToolBlock('tool-1', false)]), // expanded
      ]

      // First toggle: collapse (since one is expanded)
      const afterFirstToggle = setAllBlocksCollapsedState(messages, true)
      expect(hasAnyExpandedBlocks(afterFirstToggle)).toBe(false)

      // Second toggle: expand (since all are collapsed)
      const afterSecondToggle = setAllBlocksCollapsedState(
        afterFirstToggle,
        false,
      )
      expect(hasAnyExpandedBlocks(afterSecondToggle)).toBe(true)
    })

    test('toggle: complex nested structure toggle workflow', () => {
      const level2Blocks = [
        createToolBlock('nested-tool-1', false), // expanded
        createToolBlock('nested-tool-2', true), // collapsed
      ]
      const messages = [
        createMessage('1', 'ai', [
          createAgentBlock('agent-1', true, false, level2Blocks), // collapsed parent, mixed children
          createToolBlock('tool-1', true), // collapsed
        ]),
        createMessage('2', 'agent', undefined, { isCollapsed: true }), // collapsed agent variant
      ]

      // Any expanded? Yes (nested-tool-1 is expanded)
      expect(hasAnyExpandedBlocks(messages)).toBe(true)

      // First toggle: collapse all
      const afterCollapse = setAllBlocksCollapsedState(messages, true)
      expect(hasAnyExpandedBlocks(afterCollapse)).toBe(false)

      // Verify all are collapsed including nested
      const agentBlock = afterCollapse[0]?.blocks?.[0] as AgentContentBlock
      expect((agentBlock?.blocks?.[0] as CollapsibleBlock)?.isCollapsed).toBe(
        true,
      )
      expect((agentBlock?.blocks?.[1] as CollapsibleBlock)?.isCollapsed).toBe(
        true,
      )

      // Second toggle: expand all
      const afterExpand = setAllBlocksCollapsedState(afterCollapse, false)
      expect(hasAnyExpandedBlocks(afterExpand)).toBe(true)

      // Verify all are expanded including nested
      const expandedAgentBlock = afterExpand[0]
        ?.blocks?.[0] as AgentContentBlock
      expect(expandedAgentBlock?.isCollapsed).toBe(false)
      expect(
        (expandedAgentBlock?.blocks?.[0] as CollapsibleBlock)?.isCollapsed,
      ).toBe(false)
      expect(
        (expandedAgentBlock?.blocks?.[1] as CollapsibleBlock)?.isCollapsed,
      ).toBe(false)
      expect(
        (afterExpand[0]?.blocks?.[1] as CollapsibleBlock)?.isCollapsed,
      ).toBe(false)
      expect(afterExpand[1]?.metadata?.isCollapsed).toBe(false)
    })
  })

  describe('empty and edge case nested structures', () => {
    test('agent block with empty nested blocks array', () => {
      const messages = [
        createMessage('1', 'ai', [
          createAgentBlock('agent-1', false, false, []),
        ]),
      ]

      expect(hasAnyExpandedBlocks(messages)).toBe(true) // parent is expanded

      const result = setAllBlocksCollapsedState(messages, true)
      expect((result[0]?.blocks?.[0] as CollapsibleBlock)?.isCollapsed).toBe(
        true,
      )
    })

    test('multiple agent blocks at same level with mixed states', () => {
      const messages = [
        createMessage('1', 'ai', [
          createAgentBlock('agent-1', true, false, [
            createToolBlock('tool-1', true),
          ]),
          createAgentBlock('agent-2', false, false, [
            createToolBlock('tool-2', true),
          ]),
          createAgentBlock('agent-3', true, false, [
            createToolBlock('tool-3', false),
          ]),
        ]),
      ]

      // agent-2 is expanded, tool-3 is expanded
      expect(hasAnyExpandedBlocks(messages)).toBe(true)

      const result = setAllBlocksCollapsedState(messages, true)

      // All should be collapsed now
      expect((result[0]?.blocks?.[0] as CollapsibleBlock)?.isCollapsed).toBe(
        true,
      )
      expect((result[0]?.blocks?.[1] as CollapsibleBlock)?.isCollapsed).toBe(
        true,
      )
      expect((result[0]?.blocks?.[2] as CollapsibleBlock)?.isCollapsed).toBe(
        true,
      )

      const agent1 = result[0]?.blocks?.[0] as AgentContentBlock
      const agent2 = result[0]?.blocks?.[1] as AgentContentBlock
      const agent3 = result[0]?.blocks?.[2] as AgentContentBlock
      expect((agent1?.blocks?.[0] as CollapsibleBlock)?.isCollapsed).toBe(true)
      expect((agent2?.blocks?.[0] as CollapsibleBlock)?.isCollapsed).toBe(true)
      expect((agent3?.blocks?.[0] as CollapsibleBlock)?.isCollapsed).toBe(true)
    })

    test('nested agent blocks with all types of collapsible blocks', () => {
      const deepBlocks = [
        createToolBlock('deep-tool', false),
        createThinkingBlock('deep-think', 'expanded'),
        createAgentListBlock('deep-list', false),
      ]
      const messages = [
        createMessage('1', 'ai', [
          createAgentBlock('outer-agent', false, false, deepBlocks),
        ]),
      ]

      expect(hasAnyExpandedBlocks(messages)).toBe(true)

      const result = setAllBlocksCollapsedState(messages, true)

      const outerAgent = result[0]?.blocks?.[0] as AgentContentBlock
      expect(outerAgent?.isCollapsed).toBe(true)
      expect((outerAgent?.blocks?.[0] as CollapsibleBlock)?.isCollapsed).toBe(
        true,
      )
      expect(
        (outerAgent?.blocks?.[1] as TextContentBlock)?.thinkingCollapseState,
      ).toBe('hidden')
      expect((outerAgent?.blocks?.[2] as CollapsibleBlock)?.isCollapsed).toBe(
        true,
      )
    })
  })
})

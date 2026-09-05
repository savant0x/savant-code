// Collapse-helpers test family — hasAnyExpandedBlocks detection semantics.
// Decomposed from the FID-2026-0819-005 Loop 318 monolith; shared fixtures
// live in ./collapse-helpers-test-fixtures.

import { describe, test, expect } from 'bun:test'

import {
  createAgentBlock,
  createAgentListBlock,
  createMessage,
  createTextBlock,
  createThinkingBlock,
  createToolBlock,
  hasAnyExpandedBlocks,
} from './collapse-helpers-test-fixtures'

describe('hasAnyExpandedBlocks', () => {
  describe('empty and basic cases', () => {
    test('returns false for empty messages', () => {
      expect(hasAnyExpandedBlocks([])).toBe(false)
    })

    test('returns false for messages with no collapsible content', () => {
      const messages = [
        createMessage('1', 'user'),
        createMessage('2', 'ai', [createTextBlock('hello')]),
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(false)
    })

    test('returns false for messages with no blocks', () => {
      const messages = [createMessage('1', 'ai')]
      expect(hasAnyExpandedBlocks(messages)).toBe(false)
    })
  })

  describe('agent variant messages', () => {
    test('returns true for expanded agent variant message', () => {
      const messages = [
        createMessage('1', 'agent', undefined, { isCollapsed: false }),
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(true)
    })

    test('returns false for collapsed agent variant message', () => {
      const messages = [
        createMessage('1', 'agent', undefined, { isCollapsed: true }),
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(false)
    })

    test('returns false for agent variant message with undefined isCollapsed (treated as collapsed)', () => {
      const messages = [createMessage('1', 'agent')]
      expect(hasAnyExpandedBlocks(messages)).toBe(false)
    })
  })

  describe('tool blocks', () => {
    test('returns true when any tool block is expanded', () => {
      const messages = [
        createMessage('1', 'ai', [
          createToolBlock('tool-1', true),
          createToolBlock('tool-2', false),
        ]),
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(true)
    })

    test('returns false when all tool blocks are collapsed', () => {
      const messages = [
        createMessage('1', 'ai', [
          createToolBlock('tool-1', true),
          createToolBlock('tool-2', true),
        ]),
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(false)
    })

    test('returns false when tool block has undefined isCollapsed (treated as collapsed)', () => {
      const messages = [createMessage('1', 'ai', [createToolBlock('tool-1')])]
      expect(hasAnyExpandedBlocks(messages)).toBe(false)
    })
  })

  describe('agent blocks', () => {
    test('returns true when agent block is expanded', () => {
      const messages = [
        createMessage('1', 'ai', [createAgentBlock('agent-1', false)]),
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(true)
    })

    test('returns false when agent block is collapsed', () => {
      const messages = [
        createMessage('1', 'ai', [createAgentBlock('agent-1', true)]),
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(false)
    })

    test('returns true when nested block within collapsed agent is expanded', () => {
      const nestedBlocks = [createToolBlock('nested-tool', false)] // expanded
      const messages = [
        createMessage('1', 'ai', [
          createAgentBlock('agent-1', true, false, nestedBlocks),
        ]), // collapsed parent
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(true)
    })

    test('returns false when agent and all nested blocks are collapsed', () => {
      const nestedBlocks = [createToolBlock('nested-tool', true)] // collapsed
      const messages = [
        createMessage('1', 'ai', [
          createAgentBlock('agent-1', true, false, nestedBlocks),
        ]), // collapsed parent
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(false)
    })
  })

  describe('thinking blocks', () => {
    test('returns true when thinking block is expanded', () => {
      const messages = [
        createMessage('1', 'ai', [createThinkingBlock('think-1', 'expanded')]),
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(true)
    })

    test('returns false when thinking block is collapsed', () => {
      const messages = [
        createMessage('1', 'ai', [createThinkingBlock('think-1', 'hidden')]),
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(false)
    })
  })

  describe('agent-list blocks', () => {
    test('returns true when agent-list block is expanded', () => {
      const messages = [
        createMessage('1', 'ai', [createAgentListBlock('list-1', false)]),
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(true)
    })

    test('returns false when agent-list block is collapsed', () => {
      const messages = [
        createMessage('1', 'ai', [createAgentListBlock('list-1', true)]),
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(false)
    })
  })

  describe('multiple messages', () => {
    test('returns true when any message has expanded content', () => {
      const messages = [
        createMessage('1', 'ai', [createToolBlock('tool-1', true)]),
        createMessage('2', 'ai', [createAgentBlock('agent-1', false)]),
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(true)
    })

    test('returns false when all messages have collapsed content', () => {
      const messages = [
        createMessage('1', 'ai', [createToolBlock('tool-1', true)]),
        createMessage('2', 'ai', [createAgentBlock('agent-1', true)]),
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(false)
    })
  })

  describe('deeply nested blocks', () => {
    test('returns true when deeply nested block is expanded', () => {
      const deepNestedBlocks = [createToolBlock('deep-tool', false)] // expanded
      const nestedAgentBlocks = [
        createAgentBlock('nested-agent', true, false, deepNestedBlocks),
      ] // collapsed
      const messages = [
        createMessage('1', 'ai', [
          createAgentBlock('agent-1', true, false, nestedAgentBlocks),
        ]), // collapsed
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(true)
    })

    test('returns false when all deeply nested blocks are collapsed', () => {
      const deepNestedBlocks = [createToolBlock('deep-tool', true)] // collapsed
      const nestedAgentBlocks = [
        createAgentBlock('nested-agent', true, false, deepNestedBlocks),
      ] // collapsed
      const messages = [
        createMessage('1', 'ai', [
          createAgentBlock('agent-1', true, false, nestedAgentBlocks),
        ]), // collapsed
      ]
      expect(hasAnyExpandedBlocks(messages)).toBe(false)
    })
  })
})

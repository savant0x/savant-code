// Block-processor test family — implementor and non-implementor agent
// grouping. Sibling of the Loop-342 decomposition (shared fixtures in
// ./block-processor-test-harness).
import { describe, expect, test } from 'bun:test'

import { processBlocks } from '../block-processor'
import {
  createImplementorAgent,
  createMockHandlers,
  createNonImplementorAgent,
  createTextBlock,
} from './block-processor-test-harness'

import type { ContentBlock, AgentContentBlock } from '../../types/chat'

describe('processBlocks', () => {
  // ==========================================================================
  // Tests: Implementor Agent Grouping
  // ==========================================================================
  describe('implementor agent grouping', () => {
    test('groups single implementor agent', () => {
      const { handlers, calls } = createMockHandlers()
      const blocks: ContentBlock[] = [
        createImplementorAgent('impl-1', 'editor-implementor'),
      ]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual(['implementors-0-1'])
      expect(calls).toHaveLength(1)
      expect(calls[0].handler).toBe('onImplementorGroup')
    })
    test('groups consecutive implementor agents of different types', () => {
      const { handlers, calls } = createMockHandlers()
      const blocks: ContentBlock[] = [
        createImplementorAgent('impl-1', 'editor-implementor'),
        createImplementorAgent('impl-2', 'editor-implementor-opus'),
        createImplementorAgent('impl-3', 'editor-implementor-gpt-5'),
      ]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual(['implementors-0-3'])
      expect(calls).toHaveLength(1)
      expect(calls[0].handler).toBe('onImplementorGroup')
      const implBlocks = calls[0].args[0] as AgentContentBlock[]
      expect(implBlocks).toHaveLength(3)
    })
    test('separates implementor groups from non-implementor agents', () => {
      const { handlers, calls } = createMockHandlers()
      const blocks: ContentBlock[] = [
        createImplementorAgent('impl-1'),
        createNonImplementorAgent('fp-1', 'scout'),
        createImplementorAgent('impl-2'),
      ]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual([
        'implementors-0-1',
        'agents-1-2',
        'implementors-2-3',
      ])
      expect(calls).toHaveLength(3)
    })
  })
  // ==========================================================================
  // Tests: Non-Implementor Agent Grouping
  // ==========================================================================
  describe('non-implementor agent grouping', () => {
    test('groups single non-implementor agent', () => {
      const { handlers, calls } = createMockHandlers()
      const blocks: ContentBlock[] = [
        createNonImplementorAgent('fp-1', 'scout'),
      ]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual(['agents-0-1'])
      expect(calls).toHaveLength(1)
      expect(calls[0].handler).toBe('onAgentGroup')
    })
    test('groups consecutive small (collapsed-by-default) agents together', () => {
      const { handlers, calls } = createMockHandlers()
      const blocks: ContentBlock[] = [
        createNonImplementorAgent('fp-1', 'scout'),
        createNonImplementorAgent('b-1', 'basher'),
        createNonImplementorAgent('cs-1', 'code-searcher'),
      ]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual(['agents-0-3'])
      expect(calls).toHaveLength(1)
      expect(calls[0].handler).toBe('onAgentGroup')
      const agentBlocks = calls[0].args[0] as AgentContentBlock[]
      expect(agentBlocks).toHaveLength(3)
      expect(agentBlocks[0].agentType).toBe('scout')
      expect(agentBlocks[1].agentType).toBe('basher')
      expect(agentBlocks[2].agentType).toBe('code-searcher')
    })
    test('groups consecutive non-implementor agents including mixed sizes', () => {
      const { handlers, calls } = createMockHandlers()
      const blocks: ContentBlock[] = [
        createNonImplementorAgent('fp-1', 'scout'),
        createNonImplementorAgent('cr-1', 'code-reviewer'),
        createNonImplementorAgent('cs-1', 'code-searcher'),
      ]
      const result = processBlocks(blocks, handlers)
      // All consecutive non-implementor agents go into a single onAgentGroup call
      expect(result).toEqual(['agents-0-3'])
      expect(calls).toHaveLength(1)
      expect(calls[0].handler).toBe('onAgentGroup')
      const agentBlocks = calls[0].args[0] as AgentContentBlock[]
      expect(agentBlocks).toHaveLength(3)
      expect(agentBlocks[0].agentType).toBe('scout')
      expect(agentBlocks[1].agentType).toBe('code-reviewer')
      expect(agentBlocks[2].agentType).toBe('code-searcher')
    })
    test('separates non-implementor groups from other block types', () => {
      const { handlers, calls } = createMockHandlers()
      const blocks: ContentBlock[] = [
        createNonImplementorAgent('fp-1', 'scout'),
        createTextBlock('commentary'),
        createNonImplementorAgent('cmd-1', 'commander'),
      ]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual(['agents-0-1', 'single-1', 'agents-2-3'])
      expect(calls).toHaveLength(3)
    })
  })
})

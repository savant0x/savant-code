// Block-processor test family — single-block fallback, null filtering, mixed
// combinations, index correctness, and splitAgentsBySize. Sibling of the
// Loop-342 decomposition (shared fixtures in ./block-processor-test-harness).
import { describe, expect, test } from 'bun:test'

import { processBlocks, splitAgentsBySize } from '../block-processor'
import {
  createImageBlock,
  createImplementorAgent,
  createMockHandlers,
  createNonImplementorAgent,
  createReasoningBlock,
  createTextBlock,
  createToolBlock,
} from './block-processor-test-harness'

import type { ContentBlock, AgentContentBlock } from '../../types/chat'
import type { BlockProcessorHandlers } from '../block-processor'

describe('processBlocks', () => {
  // ==========================================================================
  // Tests: Single Block Fallback
  // ==========================================================================
  describe('single block fallback', () => {
    test('handles regular text blocks with onSingleBlock', () => {
      const { handlers, calls } = createMockHandlers()
      const blocks: ContentBlock[] = [
        createTextBlock('hello'),
        createTextBlock('world'),
      ]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual(['single-0', 'single-1'])
      expect(calls).toHaveLength(2)
      expect(calls[0].handler).toBe('onSingleBlock')
      expect(calls[1].handler).toBe('onSingleBlock')
    })
    test('handles html blocks with onSingleBlock', () => {
      const { handlers, calls } = createMockHandlers()
      const htmlBlock: ContentBlock = {
        type: 'html',
        render: () => null,
      } as ContentBlock
      const blocks: ContentBlock[] = [htmlBlock]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual(['single-0'])
      expect(calls).toHaveLength(1)
      expect(calls[0].handler).toBe('onSingleBlock')
    })
  })
  // ==========================================================================
  // Tests: Null Filtering
  // ==========================================================================
  describe('null filtering', () => {
    test('filters out null returns from handlers', () => {
      const handlers: BlockProcessorHandlers = {
        onReasoningGroup: () => null,
        onImageBlock: () => null,
        onToolGroup: () => null,
        onImplementorGroup: () => null,
        onAgentGroup: () => null,
        onSingleBlock: (block, index) =>
          index % 2 === 0 ? `single-${index}` : null,
      }
      const blocks: ContentBlock[] = [
        createTextBlock('keep'), // index 0, should be kept
        createTextBlock('skip'), // index 1, should be filtered
        createTextBlock('keep'), // index 2, should be kept
        createTextBlock('skip'), // index 3, should be filtered
      ]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual(['single-0', 'single-2'])
    })
    test('filters null from reasoning groups', () => {
      const handlers: BlockProcessorHandlers = {
        onReasoningGroup: () => null,
        onToolGroup: () => 'tool',
        onImplementorGroup: () => 'impl',
        onAgentGroup: () => 'agent',
        onSingleBlock: () => 'single',
      }
      const blocks: ContentBlock[] = [
        createReasoningBlock('thought'),
        createTextBlock('visible'),
      ]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual(['single'])
    })
    test('filters null from all handler types', () => {
      const handlers: BlockProcessorHandlers = {
        onReasoningGroup: () => null,
        onImageBlock: () => null,
        onToolGroup: () => null,
        onImplementorGroup: () => null,
        onAgentGroup: () => null,
        onSingleBlock: () => null,
      }
      const blocks: ContentBlock[] = [
        createReasoningBlock('thought'),
        createImageBlock(),
        createToolBlock('str_replace'),
        createImplementorAgent('impl-1'),
        createNonImplementorAgent('fp-1'),
        createTextBlock('text'),
      ]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual([])
    })
  })
  // ==========================================================================
  // Tests: Mixed Block Combinations
  // ==========================================================================
  describe('mixed block combinations', () => {
    test('processes typical message flow', () => {
      const { handlers, calls } = createMockHandlers()
      const blocks: ContentBlock[] = [
        createReasoningBlock('thinking about the problem'),
        createReasoningBlock('considering options'),
        createTextBlock('I will search for files first'),
        createNonImplementorAgent('fp-1', 'scout'),
        createNonImplementorAgent('cs-1', 'code-searcher'),
        createTextBlock('Now I will make changes'),
        createImplementorAgent('impl-1', 'editor-implementor'),
        createImplementorAgent('impl-2', 'editor-implementor-opus'),
        createTextBlock('Changes complete'),
      ]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual([
        'reasoning-0',
        'single-2',
        'agents-3-5',
        'single-5',
        'implementors-6-8',
        'single-8',
      ])
      expect(calls).toHaveLength(6)
    })
    test('handles interleaved tools and agents', () => {
      const { handlers, calls: _calls } = createMockHandlers()
      const blocks: ContentBlock[] = [
        createToolBlock('read_files', 'tool-1'),
        createToolBlock('code_search', 'tool-2'),
        createNonImplementorAgent('fp-1', 'scout'),
        createToolBlock('str_replace', 'tool-3'),
        createImplementorAgent('impl-1'),
      ]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual([
        'tools-0-2',
        'agents-2-3',
        'tools-3-4',
        'implementors-4-5',
      ])
    })
    test('processes complex real-world scenario', () => {
      const { handlers, calls } = createMockHandlers()
      const blocks: ContentBlock[] = [
        // Assistant thinking
        createReasoningBlock('Let me analyze this...'),
        createReasoningBlock('I see the issue'),
        // Assistant response with tool usage
        createTextBlock('I found the issue. Let me fix it.'),
        createToolBlock('str_replace', 'fix-1'),
        createToolBlock('str_replace', 'fix-2'),
        // More thinking
        createReasoningBlock('Checking if more changes needed'),
        // Final response
        createTextBlock('Done! The bug is fixed.'),
        // Image attachment
        createImageBlock('image/png', 'screenshot'),
      ]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual([
        'reasoning-0',
        'single-2',
        'tools-3-5',
        'reasoning-5',
        'single-6',
        'image-7',
      ])
      expect(calls).toHaveLength(6)
    })
  })
  // ==========================================================================
  // Tests: Index Correctness
  // ==========================================================================
  describe('index correctness', () => {
    test('maintains correct indices after grouping', () => {
      const { handlers, calls } = createMockHandlers()
      const blocks: ContentBlock[] = [
        createTextBlock('text at 0'),
        createToolBlock('tool-1', 't1'), // group starts at 1
        createToolBlock('tool-2', 't2'),
        createToolBlock('tool-3', 't3'), // group ends, nextIndex = 4
        createTextBlock('text at 4'),
        createNonImplementorAgent('a1'), // group starts at 5 (file-picker = small)
        createNonImplementorAgent('a2'), // group ends, nextIndex = 7 (file-picker = small)
        createTextBlock('text at 7'),
      ]
      processBlocks(blocks, handlers)
      // Verify startIndex and nextIndex for each group
      expect(calls[0].args[1]).toBe(0) // single text at 0
      expect(calls[1].args[1]).toBe(1) // tools start at 1
      expect(calls[1].args[2]).toBe(4) // tools next at 4
      expect(calls[2].args[1]).toBe(4) // single text at 4
      expect(calls[3].args[1]).toBe(5) // agents start at 5
      expect(calls[3].args[2]).toBe(7) // agents next at 7
      expect(calls[4].args[1]).toBe(7) // single text at 7
    })
    test('maintains correct indices for mixed-size agent groups', () => {
      const { handlers, calls } = createMockHandlers()
      const blocks: ContentBlock[] = [
        createTextBlock('text at 0'),
        createNonImplementorAgent('fp-1', 'scout'), // index 1
        createNonImplementorAgent('b-1', 'basher'), // index 2
        createNonImplementorAgent('cr-1', 'code-reviewer'), // index 3
        createNonImplementorAgent('cs-1', 'code-searcher'), // index 4
        createTextBlock('text at 5'),
      ]
      processBlocks(blocks, handlers)
      // text at 0
      expect(calls[0].handler).toBe('onSingleBlock')
      expect(calls[0].args[1]).toBe(0)
      // All non-implementor agents grouped together
      expect(calls[1].handler).toBe('onAgentGroup')
      expect(calls[1].args[1]).toBe(1)
      expect(calls[1].args[2]).toBe(5)
      expect((calls[1].args[0] as AgentContentBlock[]).length).toBe(4)
      // text at 5
      expect(calls[2].handler).toBe('onSingleBlock')
      expect(calls[2].args[1]).toBe(5)
    })
  })
})
// ============================================================================
// Tests: splitAgentsBySize
// ============================================================================
describe('splitAgentsBySize', () => {
  test('returns single group for empty array', () => {
    const result = splitAgentsBySize([])
    expect(result).toEqual([[]])
  })
  test('returns single group for one agent', () => {
    const agent = createNonImplementorAgent('cr-1', 'code-reviewer')
    const result = splitAgentsBySize([agent])
    expect(result).toEqual([[agent]])
  })
  test('groups all small agents together', () => {
    const agents = [
      createNonImplementorAgent('fp-1', 'scout'),
      createNonImplementorAgent('b-1', 'basher'),
      createNonImplementorAgent('cs-1', 'code-searcher'),
    ]
    const result = splitAgentsBySize(agents)
    expect(result).toEqual([agents])
  })
  test('gives each large agent its own group', () => {
    const agents = [
      createNonImplementorAgent('cr-1', 'code-reviewer'),
      createNonImplementorAgent('ed-1', 'editor'),
    ]
    const result = splitAgentsBySize(agents)
    expect(result).toEqual([[agents[0]], [agents[1]]])
  })
  test('splits small and large agents correctly', () => {
    const agents = [
      createNonImplementorAgent('fp-1', 'scout'),
      createNonImplementorAgent('cr-1', 'code-reviewer'),
      createNonImplementorAgent('b-1', 'basher'),
      createNonImplementorAgent('b-2', 'basher'),
      createNonImplementorAgent('ed-1', 'editor'),
      createNonImplementorAgent('rw-1', 'researcher-web'),
    ]
    const result = splitAgentsBySize(agents)
    expect(result).toEqual([
      [agents[0]], // file-picker (small)
      [agents[1]], // code-reviewer (large)
      [agents[2], agents[3]], // basher + basher (small)
      [agents[4]], // editor (large)
      [agents[5]], // researcher-web (small)
    ])
  })
})

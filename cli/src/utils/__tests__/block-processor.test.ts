// Block-processor test family — isReasoningTextBlock and basic processBlocks
// cases. Sibling of the Loop-342 decomposition (shared fixtures in
// ./block-processor-test-harness).
import { describe, expect, test } from 'bun:test'

import { isReasoningTextBlock, processBlocks } from '../block-processor'
import {
  createImageBlock,
  createMockHandlers,
  createNonImplementorAgent,
  createReasoningBlock,
  createTextBlock,
  createToolBlock,
} from './block-processor-test-harness'

import type { ContentBlock, TextContentBlock } from '../../types/chat'

// ============================================================================
// Tests: isReasoningTextBlock
// ============================================================================
describe('isReasoningTextBlock', () => {
  test('returns true for text block with textType "reasoning"', () => {
    const block = createReasoningBlock('thinking...')
    expect(isReasoningTextBlock(block)).toBe(true)
  })
  test('returns false for text block without textType', () => {
    const block = createTextBlock('normal text')
    expect(isReasoningTextBlock(block)).toBe(false)
  })
  test('returns false for text block with textType "text"', () => {
    const block = createTextBlock('normal text', 'text')
    expect(isReasoningTextBlock(block)).toBe(false)
  })
  test('returns false for non-text blocks', () => {
    expect(isReasoningTextBlock(createToolBlock('str_replace'))).toBe(false)
    expect(isReasoningTextBlock(createImageBlock())).toBe(false)
    expect(isReasoningTextBlock(createNonImplementorAgent('a1'))).toBe(false)
  })
})
// ============================================================================
// Tests: processBlocks - Basic Cases
// ============================================================================
describe('processBlocks', () => {
  describe('basic cases', () => {
    test('returns empty array for empty blocks', () => {
      const { handlers, calls } = createMockHandlers()
      const result = processBlocks([], handlers)
      expect(result).toEqual([])
      expect(calls).toHaveLength(0)
    })
    test('processes single text block with onSingleBlock', () => {
      const { handlers, calls } = createMockHandlers()
      const blocks: ContentBlock[] = [createTextBlock('hello')]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual(['single-0'])
      expect(calls).toHaveLength(1)
      expect(calls[0].handler).toBe('onSingleBlock')
      expect((calls[0].args[0] as TextContentBlock).content).toBe('hello')
      expect(calls[0].args[1]).toBe(0)
    })
  })
})

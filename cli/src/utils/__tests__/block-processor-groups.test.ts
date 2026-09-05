// Block-processor test family — reasoning, image, and tool block grouping.
// Sibling of the Loop-342 decomposition (shared fixtures in
// ./block-processor-test-harness).
import { describe, expect, test } from 'bun:test'

import { processBlocks } from '../block-processor'
import {
  createImageBlock,
  createMockHandlers,
  createReasoningBlock,
  createTextBlock,
  createToolBlock,
} from './block-processor-test-harness'

import type {
  ContentBlock,
  ImageContentBlock,
  TextContentBlock,
  ToolContentBlock,
} from '../../types/chat'
import type { BlockProcessorHandlers } from '../block-processor'
import type { MockCallRecord } from './block-processor-test-harness'

describe('processBlocks', () => {
  // ==========================================================================
  // Tests: Reasoning Block Grouping
  // ==========================================================================
  describe('reasoning block grouping', () => {
    test('groups single reasoning block', () => {
      const { handlers, calls } = createMockHandlers()
      const blocks: ContentBlock[] = [createReasoningBlock('thinking')]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual(['reasoning-0'])
      expect(calls).toHaveLength(1)
      expect(calls[0].handler).toBe('onReasoningGroup')
      expect((calls[0].args[0] as TextContentBlock[]).length).toBe(1)
      expect(calls[0].args[1]).toBe(0)
    })
    test('groups consecutive reasoning blocks together', () => {
      const { handlers, calls } = createMockHandlers()
      const blocks: ContentBlock[] = [
        createReasoningBlock('thought 1'),
        createReasoningBlock('thought 2'),
        createReasoningBlock('thought 3'),
      ]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual(['reasoning-0'])
      expect(calls).toHaveLength(1)
      expect(calls[0].handler).toBe('onReasoningGroup')
      const reasoningBlocks = calls[0].args[0] as TextContentBlock[]
      expect(reasoningBlocks).toHaveLength(3)
      expect(reasoningBlocks[0].content).toBe('thought 1')
      expect(reasoningBlocks[1].content).toBe('thought 2')
      expect(reasoningBlocks[2].content).toBe('thought 3')
    })
    test('separates reasoning groups interrupted by other blocks', () => {
      const { handlers, calls } = createMockHandlers()
      const blocks: ContentBlock[] = [
        createReasoningBlock('thought 1'),
        createTextBlock('response'),
        createReasoningBlock('thought 2'),
      ]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual(['reasoning-0', 'single-1', 'reasoning-2'])
      expect(calls).toHaveLength(3)
      expect(calls[0].handler).toBe('onReasoningGroup')
      expect(calls[1].handler).toBe('onSingleBlock')
      expect(calls[2].handler).toBe('onReasoningGroup')
    })
  })
  // ==========================================================================
  // Tests: Image Block Handling
  // ==========================================================================
  describe('image block handling', () => {
    test('handles image block with onImageBlock handler', () => {
      const { handlers, calls } = createMockHandlers()
      const blocks: ContentBlock[] = [createImageBlock('image/png', 'data123')]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual(['image-0'])
      expect(calls).toHaveLength(1)
      expect(calls[0].handler).toBe('onImageBlock')
      expect((calls[0].args[0] as ImageContentBlock).image).toBe('data123')
      expect(calls[0].args[1]).toBe(0)
    })
    test('skips image blocks when onImageBlock is not provided', () => {
      const calls: MockCallRecord[] = []
      const handlers: BlockProcessorHandlers = {
        onReasoningGroup: () => null,
        // onImageBlock intentionally omitted
        onToolGroup: () => null,
        onImplementorGroup: () => null,
        onAgentGroup: () => null,
        onSingleBlock: (block, index) => {
          calls.push({ handler: 'onSingleBlock', args: [block, index] })
          return `single-${index}`
        },
      }
      const blocks: ContentBlock[] = [
        createTextBlock('before'),
        createImageBlock(),
        createTextBlock('after'),
      ]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual(['single-0', 'single-2'])
      expect(calls).toHaveLength(2)
      // Image at index 1 was skipped, not passed to onSingleBlock
    })
    test('handles multiple consecutive images', () => {
      const { handlers, calls } = createMockHandlers()
      const blocks: ContentBlock[] = [
        createImageBlock('image/png', 'img1'),
        createImageBlock('image/jpeg', 'img2'),
      ]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual(['image-0', 'image-1'])
      expect(calls).toHaveLength(2)
      expect(calls[0].handler).toBe('onImageBlock')
      expect(calls[1].handler).toBe('onImageBlock')
    })
  })
  // ==========================================================================
  // Tests: Tool Block Grouping
  // ==========================================================================
  describe('tool block grouping', () => {
    test('groups single tool block', () => {
      const { handlers, calls } = createMockHandlers()
      const blocks: ContentBlock[] = [createToolBlock('str_replace', 'tool-1')]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual(['tools-0-1'])
      expect(calls).toHaveLength(1)
      expect(calls[0].handler).toBe('onToolGroup')
      expect((calls[0].args[0] as ToolContentBlock[]).length).toBe(1)
      expect(calls[0].args[1]).toBe(0) // startIndex
      expect(calls[0].args[2]).toBe(1) // nextIndex
    })
    test('groups consecutive tool blocks with correct indices', () => {
      const { handlers, calls } = createMockHandlers()
      const blocks: ContentBlock[] = [
        createToolBlock('str_replace', 'tool-1'),
        createToolBlock('write_file', 'tool-2'),
        createToolBlock('read_files', 'tool-3'),
      ]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual(['tools-0-3'])
      expect(calls).toHaveLength(1)
      expect(calls[0].handler).toBe('onToolGroup')
      const toolBlocks = calls[0].args[0] as ToolContentBlock[]
      expect(toolBlocks).toHaveLength(3)
      expect(toolBlocks[0].toolCallId).toBe('tool-1')
      expect(toolBlocks[1].toolCallId).toBe('tool-2')
      expect(toolBlocks[2].toolCallId).toBe('tool-3')
      expect(calls[0].args[1]).toBe(0) // startIndex
      expect(calls[0].args[2]).toBe(3) // nextIndex
    })
    test('separates tool groups interrupted by text', () => {
      const { handlers, calls } = createMockHandlers()
      const blocks: ContentBlock[] = [
        createToolBlock('str_replace', 'tool-1'),
        createTextBlock('middle'),
        createToolBlock('write_file', 'tool-2'),
      ]
      const result = processBlocks(blocks, handlers)
      expect(result).toEqual(['tools-0-1', 'single-1', 'tools-2-3'])
      expect(calls).toHaveLength(3)
      expect(calls[0].handler).toBe('onToolGroup')
      expect(calls[0].args[1]).toBe(0)
      expect(calls[0].args[2]).toBe(1)
      expect(calls[1].handler).toBe('onSingleBlock')
      expect(calls[2].handler).toBe('onToolGroup')
      expect(calls[2].args[1]).toBe(2)
      expect(calls[2].args[2]).toBe(3)
    })
  })
})

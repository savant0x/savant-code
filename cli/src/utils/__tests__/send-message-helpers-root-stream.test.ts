import { describe, test, expect } from 'bun:test'

import { appendTextToRootStream } from '../block-operations'

import type { ContentBlock, TextContentBlock } from '../../types/chat'

// ============================================================================
// Stream Chunk Processing Tests (from block-operations)
// ============================================================================

describe('appendTextToRootStream', () => {
  test('creates new text block for empty blocks array', () => {
    const result = appendTextToRootStream([], { type: 'text', text: 'Hello' })

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('text')
    expect((result[0] as TextContentBlock).content).toBe('Hello')
  })

  test('appends to existing text block of same type', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', content: 'Hello', textType: 'text' },
    ]

    const result = appendTextToRootStream(blocks, {
      type: 'text',
      text: ' World',
    })

    expect(result).toHaveLength(1)
    expect((result[0] as TextContentBlock).content).toBe('Hello World')
  })

  test('creates new block for different text type', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', content: 'Hello', textType: 'text' },
    ]

    const result = appendTextToRootStream(blocks, {
      type: 'reasoning',
      text: 'Thinking...',
    })

    expect(result).toHaveLength(2)
    expect((result[1] as TextContentBlock).textType).toBe('reasoning')
    expect((result[1] as TextContentBlock).thinkingCollapseState).toBe(
      'preview',
    )
  })

  test('returns original blocks for empty text', () => {
    const blocks: ContentBlock[] = [{ type: 'text', content: 'Hello' }]

    const result = appendTextToRootStream(blocks, { type: 'text', text: '' })

    expect(result).toBe(blocks)
  })

  // Think tag parsing tests
  test('handles unclosed think tag', () => {
    const result = appendTextToRootStream([], {
      type: 'text',
      text: 'Before <think>unclosed thoughts',
    })

    expect(result).toHaveLength(2)
    expect((result[0] as TextContentBlock).content).toBe('Before ')
    expect((result[1] as TextContentBlock).content).toBe('unclosed thoughts')
    expect((result[1] as TextContentBlock).textType).toBe('reasoning')
    expect((result[1] as TextContentBlock).thinkingOpen).toBe(true)
  })

  test('continues appending to open thinking block', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'text',
        content: 'initial thoughts',
        textType: 'reasoning',
        isCollapsed: true,
        thinkingOpen: true,
      },
    ]

    const result = appendTextToRootStream(blocks, {
      type: 'text',
      text: ' more thoughts',
    })

    expect(result).toHaveLength(1)
    expect((result[0] as TextContentBlock).content).toBe(
      'initial thoughts more thoughts',
    )
    expect((result[0] as TextContentBlock).textType).toBe('reasoning')
  })

  test('closes thinking block when close tag received', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'text',
        content: 'initial thoughts',
        textType: 'reasoning',
        isCollapsed: true,
        thinkingOpen: true,
      },
    ]

    const result = appendTextToRootStream(blocks, {
      type: 'text',
      text: ' final</think> regular text',
    })

    expect(result).toHaveLength(2)
    expect((result[0] as TextContentBlock).content).toBe(
      'initial thoughts final',
    )
    expect((result[0] as TextContentBlock).textType).toBe('reasoning')
    expect((result[0] as TextContentBlock).thinkingOpen).toBe(false)
    expect((result[1] as TextContentBlock).content).toBe(' regular text')
    expect((result[1] as TextContentBlock).textType).toBe('text')
  })

  test('text without think tags works normally', () => {
    const result = appendTextToRootStream([], {
      type: 'text',
      text: 'Just regular text without tags',
    })

    expect(result).toHaveLength(1)
    expect((result[0] as TextContentBlock).content).toBe(
      'Just regular text without tags',
    )
    expect((result[0] as TextContentBlock).textType).toBe('text')
  })

  test('closes thinking block when receiving just </think> tag', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'text',
        content: 'thoughts',
        textType: 'reasoning',
        isCollapsed: true,
        thinkingOpen: true,
      },
    ]

    const result = appendTextToRootStream(blocks, {
      type: 'text',
      text: '</think>',
    })

    expect(result).toHaveLength(1)
    expect((result[0] as TextContentBlock).content).toBe('thoughts')
    expect((result[0] as TextContentBlock).textType).toBe('reasoning')
    expect((result[0] as TextContentBlock).thinkingOpen).toBe(false)
  })

  test('closes thinking block and adds text after </think>', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'text',
        content: 'thoughts',
        textType: 'reasoning',
        isCollapsed: true,
        thinkingOpen: true,
      },
    ]

    const result = appendTextToRootStream(blocks, {
      type: 'text',
      text: '</think>after',
    })

    expect(result).toHaveLength(2)
    expect((result[0] as TextContentBlock).content).toBe('thoughts')
    expect((result[0] as TextContentBlock).textType).toBe('reasoning')
    expect((result[0] as TextContentBlock).thinkingOpen).toBe(false)
    expect((result[1] as TextContentBlock).content).toBe('after')
    expect((result[1] as TextContentBlock).textType).toBe('text')
  })

  // Streaming simulation tests
  test('streaming: does not create duplicate block when closing existing thinking block', () => {
    // Simulate streaming: first chunk opens thinking, second chunk closes it
    // First chunk: '<think>My thoughts' creates open thinking block
    const afterFirstChunk = appendTextToRootStream([], {
      type: 'text',
      text: '<think>My thoughts',
    })

    expect(afterFirstChunk).toHaveLength(1)
    expect((afterFirstChunk[0] as TextContentBlock).textType).toBe('reasoning')
    expect((afterFirstChunk[0] as TextContentBlock).content).toBe('My thoughts')
    expect((afterFirstChunk[0] as TextContentBlock).thinkingOpen).toBe(true)

    // Second chunk: '</think> after' should close the block, not create a duplicate
    const afterSecondChunk = appendTextToRootStream(afterFirstChunk, {
      type: 'text',
      text: '</think> after',
    })

    expect(afterSecondChunk).toHaveLength(2)
    expect((afterSecondChunk[0] as TextContentBlock).textType).toBe('reasoning')
    expect((afterSecondChunk[0] as TextContentBlock).content).toBe(
      'My thoughts',
    )
    expect((afterSecondChunk[0] as TextContentBlock).thinkingOpen).toBe(false)
    expect((afterSecondChunk[1] as TextContentBlock).textType).toBe('text')
    expect((afterSecondChunk[1] as TextContentBlock).content).toBe(' after')
  })

  // Native reasoning tests
  test('closes native reasoning block when text arrives', () => {
    // Native reasoning block (thinkingOpen === undefined)
    const blocks: ContentBlock[] = [
      {
        type: 'text',
        content: 'Thinking...',
        textType: 'reasoning',
        isCollapsed: true,
        thinkingId: 'think-1',
        // Note: thinkingOpen is undefined for native reasoning
      },
    ]

    const result = appendTextToRootStream(blocks, {
      type: 'text',
      text: 'Regular text',
    })

    expect(result).toHaveLength(2)
    // Native reasoning block should be closed
    expect((result[0] as TextContentBlock).thinkingOpen).toBe(false)
    // New text block added
    expect((result[1] as TextContentBlock).content).toBe('Regular text')
    expect((result[1] as TextContentBlock).textType).toBe('text')
  })

  test('appends to existing native reasoning block', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'text',
        content: 'First thought',
        textType: 'reasoning',
        isCollapsed: true,
        thinkingId: 'think-1',
        // thinkingOpen is undefined for native reasoning
      },
    ]

    const result = appendTextToRootStream(blocks, {
      type: 'reasoning',
      text: ' second thought',
    })

    expect(result).toHaveLength(1)
    expect((result[0] as TextContentBlock).content).toBe(
      'First thought second thought',
    )
    expect((result[0] as TextContentBlock).textType).toBe('reasoning')
  })
})

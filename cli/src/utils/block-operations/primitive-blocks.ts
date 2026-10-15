import type { ContentBlock, TextContentBlock } from '../../types/chat'

/**
 * Check if a text block represents an open (unclosed) thinking block.
 */
const isOpenThinkingBlock = (block: ContentBlock | undefined): boolean => {
  if (!block || block.type !== 'text') {
    return false
  }
  return block.textType === 'reasoning' && block.thinkingOpen === true
}

/**
 * Creates a new reasoning (thinking) text block.
 */
const createReasoningBlock = (
  content: string,
  thinkingOpen: boolean,
  thinkingId: string,
): TextContentBlock => ({
  type: 'text',
  content,
  textType: 'reasoning',
  thinkingCollapseState: 'preview',
  thinkingOpen,
  thinkingId,
})

/**
 * Creates a new regular text block.
 */
const createTextBlock = (content: string): TextContentBlock => ({
  type: 'text',
  content,
  textType: 'text',
})

/**
 * Checks if a block is a native reasoning block (not from <think> tags).
 * Native reasoning blocks have textType === 'reasoning' but thinkingOpen === undefined.
 */
export const isNativeReasoningBlock = (
  block: ContentBlock | undefined,
): boolean => {
  if (!block || block.type !== 'text') {
    return false
  }
  return block.textType === 'reasoning' && block.thinkingOpen === undefined
}

export { createReasoningBlock, createTextBlock, isOpenThinkingBlock }

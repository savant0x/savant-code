import {
  appendTextWithThinkParsingToBlocks,
  closeNativeReasoningBlock,
} from './think-parsing'
import { generateThinkingId } from './thinking-id'

import type { ContentBlock } from '../../types/chat'

export const appendTextToRootStream = (
  blocks: ContentBlock[],
  delta: { type: 'text' | 'reasoning'; text: string },
) => {
  if (!delta.text) {
    return blocks
  }

  // For reasoning type (from native reasoning_chunk events), use original behavior
  if (delta.type === 'reasoning') {
    const nextBlocks = [...blocks]
    const lastBlock = nextBlocks[nextBlocks.length - 1]

    if (
      lastBlock &&
      lastBlock.type === 'text' &&
      lastBlock.textType === 'reasoning'
    ) {
      const updatedBlock: ContentBlock = {
        ...lastBlock,
        content: lastBlock.content + delta.text,
      }
      nextBlocks[nextBlocks.length - 1] = updatedBlock
      return nextBlocks
    }

    const newBlock: ContentBlock = {
      type: 'text',
      content: delta.text,
      textType: 'reasoning',
      thinkingCollapseState: 'preview',
      thinkingId: generateThinkingId(),
    }

    return [...nextBlocks, newBlock]
  }

  // For text type: first close any open native reasoning block, then parse for <think> tags
  const blocksWithClosedReasoning = closeNativeReasoningBlock(blocks)
  return appendTextWithThinkParsingToBlocks(
    blocksWithClosedReasoning,
    delta.text,
  )
}

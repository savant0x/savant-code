import type { ContentBlock } from '../../types/chat'

/**
 * Appends an interruption notice to blocks, either by modifying the last
 * text block or adding a new one.
 */
export const appendInterruptionNotice = (
  blocks: ContentBlock[],
): ContentBlock[] => {
  const lastBlock = blocks[blocks.length - 1]

  if (lastBlock && lastBlock.type === 'text') {
    const interruptedBlock: ContentBlock = {
      ...lastBlock,
      content: `${lastBlock.content}\n\n[response interrupted]`,
    }
    return [...blocks.slice(0, -1), interruptedBlock]
  }

  const interruptionNotice: ContentBlock = {
    type: 'text',
    content: '[response interrupted]',
  }
  return [...blocks, interruptionNotice]
}

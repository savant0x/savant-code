import type { ContentBlock } from '../../types/chat'

/**
 * Recursively collapses blocks that weren't manually opened by the user.
 * Preserves user intent by keeping blocks open if userOpened is true.
 */
export const autoCollapseBlocks = (blocks: ContentBlock[]): ContentBlock[] => {
  return blocks.map((block) => {
    // Handle thinking blocks (grouped text blocks)
    if (block.type === 'text' && block.thinkingId) {
      return block.userOpened
        ? block
        : { ...block, thinkingCollapseState: 'hidden' as const }
    }

    // Handle agent blocks
    if (block.type === 'agent') {
      const updatedBlock = block.userOpened
        ? block
        : { ...block, isCollapsed: true }

      // Recursively update nested blocks
      if (updatedBlock.blocks) {
        return {
          ...updatedBlock,
          blocks: autoCollapseBlocks(updatedBlock.blocks),
        }
      }
      return updatedBlock
    }

    // Handle tool blocks
    if (block.type === 'tool') {
      return block.userOpened ? block : { ...block, isCollapsed: true }
    }

    // Handle agent-list blocks
    if (block.type === 'agent-list') {
      return block.userOpened ? block : { ...block, isCollapsed: true }
    }

    return block
  })
}

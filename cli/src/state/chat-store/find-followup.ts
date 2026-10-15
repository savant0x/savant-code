import type { ChatMessage, ContentBlock } from '../../types/chat'

const findLatestFollowupInBlocks = (
  blocks: ContentBlock[] | undefined,
): string | null => {
  if (!blocks) return null

  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i]
    if (block.type === 'tool' && block.toolName === 'suggest_followups') {
      return block.toolCallId
    }
    if (block.type === 'agent') {
      const nested = findLatestFollowupInBlocks(block.blocks)
      if (nested) return nested
    }
  }

  return null
}

/**
 * Walk messages newest-first and return the toolCallId of the most recent
 * suggest_followups tool block, if any. Extracted from chat-store.ts
 * (FID-2026-0805-003).
 */
export const getLatestFollowupToolCallId = (
  messages: ChatMessage[],
): string | null => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const latest = findLatestFollowupInBlocks(messages[i]?.blocks)
    if (latest) return latest
  }
  return null
}

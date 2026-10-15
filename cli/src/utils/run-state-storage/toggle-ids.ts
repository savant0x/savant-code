import type { ChatMessage, ContentBlock } from '../../types/chat'

/**
 * Recursively extract all agent IDs and tool call IDs from content blocks
 */
function extractToggleIds(blocks: ContentBlock[] | undefined): string[] {
  if (!blocks) return []

  const ids: string[] = []

  for (const block of blocks) {
    if (block.type === 'agent') {
      ids.push(block.agentId)
      // Recursively extract from nested blocks
      ids.push(...extractToggleIds(block.blocks))
    } else if (block.type === 'tool') {
      ids.push(block.toolCallId)
    }
  }

  return ids
}

/**
 * Get all toggle IDs (agent IDs and tool call IDs) from chat messages
 */
export function getAllToggleIdsFromMessages(messages: ChatMessage[]): string[] {
  const ids: string[] = []

  for (const message of messages) {
    ids.push(...extractToggleIds(message.blocks))
  }

  return ids
}

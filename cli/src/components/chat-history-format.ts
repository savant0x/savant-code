import { formatRelativeTime } from '../utils/chat-history'

import type { SelectableListItem } from './selectable-list'
import type { ChatHistoryEntry } from '../utils/chat-history'

export const LAYOUT = {
  CONTENT_PADDING: 4,
  COMPACT_MODE_THRESHOLD: 20, // Hide header when terminal height is below this
  NARROW_WIDTH_THRESHOLD: 70, // Hide buttons when terminal width is below this
  MAIN_CONTENT_PADDING: 2,
  INITIAL_CHATS: 25, // Load this many immediately for fast display
  BACKGROUND_CHATS: 475, // Load this many more in the background for search
  MAX_RENDERED_CHATS: 100, // Only render this many in the list
  TIME_COL_WIDTH: 12, // e.g., "2 hours ago"
  MSGS_COL_WIDTH: 9, // e.g., "!999 msgs"
  DELETE_COL_WIDTH: 6, // e.g., "[×]" + marginRight
  GAP_WIDTH: 3, // gap between columns
} as const

/**
 * True when every listed chat is explicitly marked interrupted (completed ===
 * false) and at least one chat exists. Unreadable chats carry undefined and
 * suppress the hint — corruption is not the same as an interrupted session.
 */
export function allChatsInterrupted(chats: ChatHistoryEntry[]): boolean {
  return chats.length > 0 && chats.every((c) => c.completed === false)
}

/** Truncate text to fit single line */
export function truncateText(text: string, maxLen: number): string {
  const singleLine = text.replace(/\n/g, ' ').trim()
  if (singleLine.length <= maxLen) return singleLine
  return singleLine.slice(0, maxLen - 1) + '…'
}

/** Pad text to fixed width (right-pad with spaces) */
export function padRight(text: string, width: number): string {
  // Use Array.from to count code points so emoji/wide chars don't break padding
  const len = Array.from(text).length
  if (len >= width) return text
  return text + ' '.repeat(width - len)
}

/** Column width reserved for the variable-width prompt column. */
export function computeChatColumnWidths(contentWidth: number): number {
  // reservedWidth accounts for: time col, msgs col, delete button area,
  // 2 gaps between columns, list border (2), scrollbar (1), and button padding (2)
  const reservedWidth =
    LAYOUT.TIME_COL_WIDTH +
    LAYOUT.MSGS_COL_WIDTH +
    LAYOUT.DELETE_COL_WIDTH +
    LAYOUT.GAP_WIDTH * 2 +
    5 // border + scrollbar + button padding
  return Math.max(20, contentWidth - reservedWidth)
}

/**
 * Format a chat history entry into a SelectableListItem with aligned columns:
 * time | message count | prompt. The full prompt is kept in secondary for
 * search filtering.
 */
export function formatChatRow(
  chat: ChatHistoryEntry,
  maxPromptWidth: number,
): SelectableListItem {
  const time = padRight(
    formatRelativeTime(chat.timestamp),
    LAYOUT.TIME_COL_WIDTH,
  )
  const msgs = padRight(
    chat.unreadable
      ? '—'
      : chat.completed === false
        ? `!${chat.messageCount} msgs`
        : `${chat.messageCount} msgs`,
    LAYOUT.MSGS_COL_WIDTH,
  )
  const prompt = padRight(
    truncateText(chat.lastPrompt, maxPromptWidth),
    maxPromptWidth,
  )

  return {
    id: chat.chatId,
    // Combine all columns into label for correct display order: time | msgs | prompt
    // The full prompt is kept in secondary for search filtering
    label: `${time}${' '.repeat(LAYOUT.GAP_WIDTH)}${msgs}${' '.repeat(LAYOUT.GAP_WIDTH)}${prompt}`,
    icon: undefined,
    secondary: chat.lastPrompt, // Keep original prompt for search
    hideSecondary: true, // Don't display secondary, only use for filtering
  }
}

import { useCallback } from 'react'

import { LAYOUT } from './chat-history-format'
import { isPlainEnterKey } from '../utils/terminal-enter-detection'

import type { SelectableListItem } from './selectable-list'

interface ChatHistoryKeyboardOptions {
  searchQuery: string
  setSearchQuery: (query: string) => void
  focusedIndex: number
  setFocusedIndex: (updater: (prev: number) => number) => void
  filteredItems: SelectableListItem[]
  selectChat: (chatId: string) => void
  onCancel: () => void
}

type KeyLike = {
  name?: string
  sequence?: string
  shift?: boolean
  ctrl?: boolean
  meta?: boolean
  option?: boolean
}

/**
 * Keyboard intercept for the chat-history screen: escape clears search (or
 * cancels), up/down move focus, Enter selects, ctrl+c cancels. Returns true
 * when the key was consumed.
 */
export function useChatHistoryKeyboard({
  searchQuery,
  setSearchQuery,
  focusedIndex,
  setFocusedIndex,
  filteredItems,
  selectChat,
  onCancel,
}: ChatHistoryKeyboardOptions): (key: KeyLike) => boolean {
  return useCallback(
    (key: KeyLike) => {
      if (key.name === 'escape') {
        if (searchQuery.length > 0) {
          setSearchQuery('')
        } else {
          onCancel()
        }
        return true
      }
      if (key.name === 'up') {
        setFocusedIndex((prev) => Math.max(0, prev - 1))
        return true
      }
      if (key.name === 'down') {
        const maxIndex =
          Math.min(filteredItems.length, LAYOUT.MAX_RENDERED_CHATS) - 1
        setFocusedIndex((prev) => Math.min(maxIndex, prev + 1))
        return true
      }
      if (isPlainEnterKey(key)) {
        const focused = filteredItems[focusedIndex]
        if (focused) {
          selectChat(focused.id)
        }
        return true
      }
      if (key.name === 'c' && key.ctrl) {
        onCancel()
        return true
      }
      return false
    },
    [
      searchQuery,
      setSearchQuery,
      setFocusedIndex,
      filteredItems,
      focusedIndex,
      selectChat,
      onCancel,
    ],
  )
}

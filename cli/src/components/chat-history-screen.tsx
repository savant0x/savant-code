import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { ChatHistoryBottomBar, ChatHistoryTitle } from './chat-history-chrome'
import {
  LAYOUT,
  computeChatColumnWidths,
  formatChatRow,
} from './chat-history-format'
import { MultilineInput } from './multiline-input'
import { SelectableList } from './selectable-list'
import { useChatHistoryKeyboard } from './use-chat-history-keyboard'
import { useSearchableList } from '../hooks/use-searchable-list'
import { useTerminalLayout } from '../hooks/use-terminal-layout'
import { useTheme } from '../hooks/use-theme'
import { deleteChatSession, getAllChats } from '../utils/chat-history'

import type { SelectableListItem } from './selectable-list'

// Re-export the pure helper from the original path (focused-test call-graph).
export { allChatsInterrupted } from './chat-history-format'

interface ChatHistoryScreenProps {
  onSelectChat: (chatId: string) => void
  onCancel: () => void
  onNewChat: () => void
}

export const ChatHistoryScreen: React.FC<ChatHistoryScreenProps> = ({
  onSelectChat,
  onCancel,
  onNewChat,
}) => {
  const theme = useTheme()
  const { terminalWidth, terminalHeight } = useTerminalLayout()

  // Layout calculations - use full width
  const contentWidth = terminalWidth - LAYOUT.CONTENT_PADDING
  const maxPromptWidth = computeChatColumnWidths(contentWidth)

  // Two-phase loading: load initial chats immediately, then more in background
  const [chats, setChats] = useState(() => getAllChats(LAYOUT.INITIAL_CHATS))
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // Load more chats in the background after initial render
  useEffect(() => {
    // Use setTimeout to defer the expensive loading to after first paint
    const timer = setTimeout(() => {
      setChats(getAllChats(LAYOUT.INITIAL_CHATS + LAYOUT.BACKGROUND_CHATS))
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const handleDeleteChat = useCallback((chatId: string) => {
    const deleted = deleteChatSession(chatId)
    if (deleted) {
      setChats((prev) => prev.filter((chat) => chat.chatId !== chatId))
      setStatusMessage('Chat deleted')
      return
    }

    setStatusMessage('Could not delete chat')
  }, [])

  // Convert chats to SelectableListItem format with aligned columns
  // Order: time | message count | prompt
  const chatItems: SelectableListItem[] = useMemo(
    () => chats.map((chat) => formatChatRow(chat, maxPromptWidth)),
    [chats, maxPromptWidth],
  )

  // Custom filter function that searches the original prompt (stored in secondary)
  const filterByPrompt = useCallback(
    (item: SelectableListItem, query: string) =>
      (item.secondary ?? '').toLowerCase().includes(query.toLowerCase()),
    [],
  )

  // Search filtering and focus management
  const {
    searchQuery,
    setSearchQuery,
    focusedIndex,
    setFocusedIndex,
    filteredItems,
    handleFocusChange,
  } = useSearchableList({
    items: chatItems,
    filterFn: filterByPrompt,
  })

  const isCompactMode = terminalHeight < LAYOUT.COMPACT_MODE_THRESHOLD
  const isNarrowWidth = terminalWidth < LAYOUT.NARROW_WIDTH_THRESHOLD

  // No need to calculate listHeight - let flexbox handle it naturally

  // Unreadable chats (corrupt chat-messages.json) can be deleted but not resumed
  const unreadableChatIds = useMemo(
    () => new Set(chats.filter((chat) => chat.unreadable).map((c) => c.chatId)),
    [chats],
  )

  // Handle chat selection
  const selectChat = useCallback(
    (chatId: string) => {
      if (unreadableChatIds.has(chatId)) {
        setStatusMessage("Chat file is corrupted and can't be opened")
        return
      }
      onSelectChat(chatId)
    },
    [onSelectChat, unreadableChatIds],
  )

  const handleChatSelect = useCallback(
    (item: SelectableListItem) => {
      selectChat(item.id)
    },
    [selectChat],
  )

  const handleChatDelete = useCallback(
    (item: SelectableListItem) => {
      handleDeleteChat(item.id)
    },
    [handleDeleteChat],
  )

  // Handle keyboard input
  const handleKeyIntercept = useChatHistoryKeyboard({
    searchQuery,
    setSearchQuery,
    focusedIndex,
    setFocusedIndex,
    filteredItems,
    selectChat,
    onCancel,
  })

  return (
    <box
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: theme.surface,
        padding: 0,
        flexDirection: 'column',
      }}
    >
      {/* Main content area */}
      <box
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          width: '100%',
          paddingLeft: 2,
          paddingRight: 2,
          paddingTop: isCompactMode ? 0 : 1,
          paddingBottom: 0,
          gap: 0,
          flexGrow: 1,
          flexShrink: 1,
        }}
      >
        {/* Title */}
        {!isCompactMode && <ChatHistoryTitle chats={chats} />}

        {/* Search input */}
        <box
          style={{
            width: contentWidth,
            flexShrink: 0,
            marginBottom: 0,
          }}
        >
          <MultilineInput
            value={searchQuery}
            onChange={({ text }) => setSearchQuery(text)}
            onSubmit={() => {}}
            onPaste={() => {}}
            onKeyIntercept={handleKeyIntercept}
            placeholder="Search chats..."
            focused={true}
            maxHeight={1}
            minHeight={1}
            cursorPosition={searchQuery.length}
          />
        </box>

        {/* Chat list - grows to fill remaining space */}
        <box
          style={{
            flexDirection: 'column',
            width: contentWidth,
            borderStyle: 'single',
            borderColor: theme.muted,
            flexGrow: 1,
            flexShrink: 1,
            overflow: 'hidden',
          }}
          border={['top', 'bottom', 'left', 'right']}
        >
          <SelectableList
            items={filteredItems.slice(0, LAYOUT.MAX_RENDERED_CHATS)}
            focusedIndex={focusedIndex}
            onSelect={handleChatSelect}
            actionLabel="[×]"
            onAction={handleChatDelete}
            onFocusChange={handleFocusChange}
            emptyMessage={
              chats.length === 0
                ? 'No chat history yet'
                : searchQuery
                  ? 'No matching chats'
                  : 'No chats found'
            }
          />
        </box>
      </box>

      {/* Bottom bar */}
      <ChatHistoryBottomBar
        contentWidth={contentWidth}
        isNarrowWidth={isNarrowWidth}
        statusMessage={statusMessage}
        onNewChat={onNewChat}
        onCancel={onCancel}
      />
    </box>
  )
}

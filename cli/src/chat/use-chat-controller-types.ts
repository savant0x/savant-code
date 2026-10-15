import type { UseChatDataReturn } from './use-chat-data'
import type { useChatInteractions } from './use-chat-interactions'
import type { UseChatPickersReturn } from './use-chat-pickers'
import type { MultilineInputHandle } from '../components/multiline-input'
import type { useChatMessages } from '../hooks/use-chat-messages'
import type { ChatScrollboxProps, useChatUI } from '../hooks/use-chat-ui'
import type { ChatMessage } from '../types/chat'
import type {
  AskUserState,
  InputValue,
  PendingBashMessage,
} from '../types/store'
import type { ChatTheme } from '../types/theme-system'
import type { AgentMode } from '../utils/constants'
import type { BoxRenderable, ScrollBoxRenderable } from '@opentui/core'
import type { MutableRefObject } from 'react'

/** Bundle handed from useChatController to useChatLayout (FID-2026-0805-003). */
export interface ChatControllerCore {
  // Chat state
  messages: ChatMessage[]
  pendingBashMessages: PendingBashMessage[]
  inputValue: string
  cursorPosition: number
  lastEditDueToNav: boolean
  setInputValue: (
    value: InputValue | ((prev: InputValue) => InputValue),
  ) => void
  inputFocused: boolean
  inputRef: MutableRefObject<MultilineInputHandle | null>
  agentMode: AgentMode
  toggleAgentMode: () => void
  setAgentMode: (mode: AgentMode) => void
  slashSelectedIndex: number
  agentSelectedIndex: number
  isRetrying: boolean
  showSuggestedPrompts: boolean
  askUserState: AskUserState | null
  // Data + pickers
  data: UseChatDataReturn
  pickers: UseChatPickersReturn
  // Message tree
  messageTree: ReturnType<typeof useChatMessages>['messageTree']
  visibleTopLevelMessages: ChatMessage[]
  hiddenMessageCount: number
  handleCollapseToggle: ReturnType<
    typeof useChatMessages
  >['handleCollapseToggle']
  handleLoadPreviousMessages: () => void
  handleToggleAll: () => void
  // UI metrics
  ui: {
    scrollRef: MutableRefObject<ScrollBoxRenderable | null>
    scrollToLatest: () => void
    scrollUp: () => void
    scrollDown: () => void
    appliedScrollboxProps: ChatScrollboxProps
    isAtBottom: boolean
    hasOverflow: boolean
    terminalWidth: number
    terminalHeight: number
    separatorWidth: number
    messageAvailableWidth: number
    isCompactHeight: boolean
    isNarrowWidth: boolean
    theme: ChatTheme
    markdownPalette: ReturnType<typeof useChatUI>['markdownPalette']
  }
  // Header visibility
  header: {
    headerRef: MutableRefObject<BoxRenderable | null>
    isHeaderVisible: boolean
  }
  // Interactions
  interactions: ReturnType<typeof useChatInteractions>
}

import type { MultilineInputHandle } from '../components/multiline-input'
import type { useAgentValidation } from '../hooks/use-agent-validation'
import type { useSendMessage } from '../hooks/use-send-message'
import type { ChatMessage } from '../types/chat'
import type { SendMessageFn } from '../types/contracts/send-message'
import type { InputValue, PendingBashMessage } from '../types/store'
import type { User } from '../utils/auth'
import type { AgentMode } from '../utils/constants'
import type { FileTreeNode } from '@savant-code/common/util/file'
import type { UseMutationResult } from '@tanstack/react-query'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

export interface UseChatInteractionsArgs {
  agentMode: AgentMode
  agentId?: string
  initialPrompt: string | null
  inputValue: string
  cursorPosition: number
  lastEditDueToNav: boolean
  inputRef: MutableRefObject<MultilineInputHandle | null>
  messages: ChatMessage[]
  pendingBashMessages: PendingBashMessage[]
  setMessages: (
    value: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void
  setInputValue: (
    value: InputValue | ((prev: InputValue) => InputValue),
  ) => void
  setInputFocused: (focused: boolean) => void
  setAgentMode: (mode: AgentMode) => void
  focusedAgentId: string | null
  setFocusedAgentId: (
    value: string | null | ((prev: string | null) => string | null),
  ) => void
  toggleAgentMode: () => void
  slashSelectedIndex: number
  setSlashSelectedIndex: (value: number | ((prev: number) => number)) => void
  agentSelectedIndex: number
  setAgentSelectedIndex: (value: number | ((prev: number) => number)) => void
  activeAgentStreamsRef: MutableRefObject<number>
  isChainInProgressRef: MutableRefObject<boolean>
  activeSubagentsRef: MutableRefObject<Set<string>>
  abortControllerRef: MutableRefObject<AbortController | null>
  sendMessageRef: MutableRefObject<SendMessageFn | undefined>
  terminalWidth: number
  separatorWidth: number
  isCompactHeight: boolean
  isNarrowWidth: boolean
  scrollToLatest: () => void
  scrollUp: () => void
  scrollDown: () => void
  handleToggleAll: () => void
  validateAgents: ReturnType<typeof useAgentValidation>['validate']
  continueChat: boolean
  continueChatId?: string
  subscriptionData: Parameters<typeof useSendMessage>[0]['subscriptionData']
  setIsAuthenticated: Dispatch<SetStateAction<boolean | null>>
  setUser: Dispatch<SetStateAction<User | null>>
  logoutMutation: UseMutationResult<boolean, Error, void, unknown>
  showSuggestedPrompts: boolean
  setShowSuggestedPrompts: Dispatch<SetStateAction<boolean>>
  fileTree: FileTreeNode[]
  hasSubscription: boolean
  modelPickerOpen: boolean
  providerPickerOpen: boolean
  rewindPickerOpen: boolean
}

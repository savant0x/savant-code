import type { MultilineInputHandle } from '../components/multiline-input'
import type { useAgentValidation } from '../hooks/use-agent-validation'
import type { useSendMessage } from '../hooks/use-send-message'
import type { ChatMessage } from '../types/chat'
import type { SendMessageFn } from '../types/contracts/send-message'
import type { InputValue, PendingBashMessage } from '../types/store'
import type { User } from '../utils/auth'
import type { AgentMode } from '../utils/constants'
import type { UseMutationResult } from '@tanstack/react-query'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

export interface UseChatMessagingArgs {
  agentMode: AgentMode
  agentId?: string
  inputValue: string
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
  terminalWidth: number
  separatorWidth: number
  activeAgentStreamsRef: MutableRefObject<number>
  isChainInProgressRef: MutableRefObject<boolean>
  activeSubagentsRef: MutableRefObject<Set<string>>
  abortControllerRef: MutableRefObject<AbortController | null>
  sendMessageRef: MutableRefObject<SendMessageFn | undefined>
  scrollToLatest: () => void
  validateAgents: ReturnType<typeof useAgentValidation>['validate']
  saveToHistory: (value: string) => void
  continueChat: boolean
  continueChatId?: string
  subscriptionData: Parameters<typeof useSendMessage>[0]['subscriptionData']
  setIsAuthenticated: Dispatch<SetStateAction<boolean | null>>
  setUser: Dispatch<SetStateAction<User | null>>
  logoutMutation: UseMutationResult<boolean, Error, void, unknown>
  showSuggestedPrompts: boolean
  setShowSuggestedPrompts: Dispatch<SetStateAction<boolean>>
}

/**
 * Interaction wiring for the chat screen (FID-2026-0805-003). Composes the
 * messaging pipeline, overlays, suggestion engine, input history, chat input,
 * and keyboard assembly. All bodies extracted from chat.tsx verbatim; this
 * hook owns the values the layout needs (submit, menus, overlay state).
 */

import { useMemo } from 'react'

import { useChatKeyboardAssembly } from './use-chat-keyboard'
import { useChatMessaging } from './use-chat-messaging'
import { useChatOverlays } from './use-chat-overlays'
import { useChatSuggestions } from './use-chat-suggestions'
import { useChatInput } from '../hooks/use-chat-input'
import { useInputHistory } from '../hooks/use-input-history'
import { useChatStore } from '../state/chat-store'
import { loadLocalAgents } from '../utils/local-agent-registry'

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

export function useChatInteractions(args: UseChatInteractionsArgs) {
  const {
    agentMode,
    agentId,
    initialPrompt,
    inputValue,
    cursorPosition,
    lastEditDueToNav,
    inputRef,
    messages,
    pendingBashMessages,
    setMessages,
    setInputValue,
    setInputFocused,
    setAgentMode,
    focusedAgentId,
    setFocusedAgentId,
    toggleAgentMode,
    slashSelectedIndex,
    setSlashSelectedIndex,
    agentSelectedIndex,
    setAgentSelectedIndex,
    activeAgentStreamsRef,
    isChainInProgressRef,
    activeSubagentsRef,
    abortControllerRef,
    sendMessageRef,
    terminalWidth,
    separatorWidth,
    isCompactHeight,
    isNarrowWidth,
    scrollToLatest,
    scrollUp,
    scrollDown,
    handleToggleAll,
    validateAgents,
    continueChat,
    continueChatId,
    subscriptionData,
    setIsAuthenticated,
    setUser,
    logoutMutation,
    showSuggestedPrompts,
    setShowSuggestedPrompts,
    fileTree,
    hasSubscription,
    modelPickerOpen,
    providerPickerOpen,
    rewindPickerOpen,
  } = args

  const localAgents = useMemo(() => loadLocalAgents(agentMode), [agentMode])
  const inputMode = useChatStore((state) => state.inputMode)
  const setInputMode = useChatStore((state) => state.setInputMode)
  const askUserState = useChatStore((state) => state.askUserState)
  const adsEnabled = useChatStore((state) => state.adsEnabled)

  const { saveToHistory, navigateUp, navigateDown, resetHistoryNavigation } =
    useInputHistory(inputValue, setInputValue, { inputMode, setInputMode })

  const {
    isConnected,
    showReconnectionMessage,
    timerStartTime,
    streamStatus,
    isWaitingForResponse,
    isStreaming,
    queuedMessages,
    queuePaused,
    queuedCount,
    shouldShowQueuePreview,
    queuePreviewTitle,
    pausedQueueText,
    inputPlaceholder,
    handleCtrlC,
    nextCtrlCWillExit,
    clearQueue,
    pauseQueue,
    onSubmitPrompt,
    handleSelectSuggestedPrompt,
  } = useChatMessaging({
    agentMode,
    agentId,
    inputValue,
    inputRef,
    messages,
    pendingBashMessages,
    setMessages,
    setInputValue,
    setInputFocused,
    terminalWidth,
    separatorWidth,
    activeAgentStreamsRef,
    isChainInProgressRef,
    activeSubagentsRef,
    abortControllerRef,
    sendMessageRef,
    scrollToLatest,
    validateAgents,
    saveToHistory,
    continueChat,
    continueChatId,
    subscriptionData,
    setIsAuthenticated,
    setUser,
    logoutMutation,
    showSuggestedPrompts,
    setShowSuggestedPrompts,
  })

  const {
    feedbackMode,
    feedbackText,
    setFeedbackText,
    handleMessageFeedback,
    handleCloseFeedback,
    handleExitFeedback,
    handleExitPublish,
    handleReviewOptionSelect,
    handleCloseReviewScreen,
    handleReviewCustom,
    handlePublish,
    handleSubmit,
    handleCommandResult,
    reviewMode,
    publishMode,
  } = useChatOverlays({
    onSubmitPrompt,
    agentMode,
    inputValue,
    cursorPosition,
    inputRef,
    setInputValue,
    setInputFocused,
    setInputMode,
    resetHistoryNavigation,
    askUserState,
  })

  const {
    slashContext,
    mentionContext,
    slashMatches,
    agentMatches,
    fileMatches,
    slashSuggestionItems,
    agentSuggestionItems,
    fileSuggestionItems,
    openFileMenuWithTab,
    handleMentionItemClick,
    handleSlashItemClick,
    executeSlashCommand,
    applySlashInsertText,
    selectMentionAt,
  } = useChatSuggestions({
    inputValue,
    cursorPosition,
    inputMode,
    agentMode,
    fileTree,
    localAgents,
    adsEnabled,
    hasSubscription,
    setInputValue,
    slashSelectedIndex,
    setSlashSelectedIndex,
    agentSelectedIndex,
    setAgentSelectedIndex,
    onSubmitPrompt,
    handleCommandResult,
  })

  const { inputWidth, handleBuildFast, handleBuildMax, handleBuildLite } =
    useChatInput({
      setInputValue,
      agentMode,
      setAgentMode,
      separatorWidth,
      initialPrompt,
      onSubmitPrompt,
      isCompactHeight,
      isNarrowWidth,
    })

  const { chatKeyboardHandlers } = useChatKeyboardAssembly({
    inputMode,
    inputValue,
    feedbackMode,
    feedbackText,
    cursorPosition,
    lastEditDueToNav,
    isStreaming,
    isWaitingForResponse,
    focusedAgentId,
    slashActive: slashContext.active,
    mentionActive: mentionContext.active,
    slashSelectedIndex,
    agentSelectedIndex,
    slashMatchesLength: slashMatches.length,
    agentMatchesLength: agentMatches.length,
    fileMatchesLength: fileMatches.length,
    modelPickerOpen,
    nextCtrlCWillExit,
    queuePaused,
    queuedCount,
    setInputMode,
    handleCloseFeedback,
    setFeedbackText,
    setInputValue,
    abortControllerRef,
    queuedMessagesLength: queuedMessages.length,
    pauseQueue,
    setSlashSelectedIndex,
    slashMatches,
    slashContext,
    applySlashInsertText,
    onSubmitPrompt,
    agentMode,
    handleCommandResult,
    setAgentSelectedIndex,
    selectMentionAt,
    openFileMenuWithTab,
    navigateUp,
    navigateDown,
    toggleAgentMode,
    setFocusedAgentId,
    setInputFocused,
    inputRef,
    handleCtrlC,
    clearQueue,
    scrollUp,
    scrollDown,
    handleToggleAll,
    executeSlashCommand,
    askUserState,
    reviewMode,
    providerPickerOpen,
    rewindPickerOpen,
  })

  return {
    inputMode,
    askUserState,
    isConnected,
    showReconnectionMessage,
    timerStartTime,
    streamStatus,
    isWaitingForResponse,
    isStreaming,
    shouldShowQueuePreview,
    queuePreviewTitle,
    pausedQueueText,
    inputPlaceholder,
    nextCtrlCWillExit,
    handleSelectSuggestedPrompt,
    feedbackMode,
    handleMessageFeedback,
    handleCloseFeedback,
    handleExitFeedback,
    handleExitPublish,
    handleReviewOptionSelect,
    handleCloseReviewScreen,
    handleReviewCustom,
    handlePublish,
    handleSubmit,
    reviewMode,
    publishMode,
    slashContext,
    mentionContext,
    slashSuggestionItems,
    agentSuggestionItems,
    fileSuggestionItems,
    handleMentionItemClick,
    handleSlashItemClick,
    inputWidth,
    handleBuildFast,
    handleBuildMax,
    handleBuildLite,
    chatKeyboardHandlers,
  }
}

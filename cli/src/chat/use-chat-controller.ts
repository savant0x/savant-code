/**
 * Composition root for the chat screen (FID-2026-0805-003), first half.
 * Gathers props, chat state, data selectors, pickers, bootstrap effects, the
 * message tree, UI metrics, header visibility, and the interaction wiring,
 * returning a typed ChatControllerCore bundle consumed by useChatLayout.
 * All callback/effect bodies were moved out of chat.tsx verbatim.
 */

import { useState } from 'react'

import { useChatBootstrap } from './use-chat-bootstrap'
import { useChatData } from './use-chat-data'
import { useChatHeaderVisibility } from './use-chat-header-visibility'
import { useChatInteractions } from './use-chat-interactions'
import { useChatPickers } from './use-chat-pickers'
import { useAgentValidation } from '../hooks/use-agent-validation'
import { useAskUserBridge } from '../hooks/use-ask-user-bridge'
import { useChatMessages } from '../hooks/use-chat-messages'
import { useChatState } from '../hooks/use-chat-state'
import { useChatUI } from '../hooks/use-chat-ui'
import { useScaffoldRevertSubscriber } from '../hooks/use-scaffold-revert-subscriber'
import { useUsageMonitor } from '../hooks/use-usage-monitor'
import { useChatStore } from '../state/chat-store'
import { IS_SAVANT_FREE } from '../utils/constants'
import { hasSubmittedFirstPrompt } from '../utils/settings'

import type { ChatProps } from './types'
import type { ChatControllerCore } from './use-chat-controller-types'

export type { ChatControllerCore } from './use-chat-controller-types'

export function useChatController(props: ChatProps): ChatControllerCore {
  const {
    initialPrompt,
    agentId,
    fileTree,
    inputRef,
    setIsAuthenticated,
    setUser,
    logoutMutation,
    continueChat,
    continueChatId,
    initialMode,
    initialPermissionMode,
  } = props

  const [showSuggestedPrompts, setShowSuggestedPrompts] = useState(
    () => IS_SAVANT_FREE && !hasSubmittedFirstPrompt(),
  )

  const { validate: validateAgents } = useAgentValidation()

  // Subscribe to ask_user bridge to trigger form display
  useAskUserBridge()

  // Auto-revert from SCAFFOLD to HYBRID when the orchestrator declares the
  // scaffold complete via the set_scaffold_complete tool.
  useScaffoldRevertSubscriber()

  // Monitor usage data and auto-show banner when thresholds are crossed
  useUsageMonitor()

  // Get chat state from extracted hook
  const {
    inputValue,
    cursorPosition,
    lastEditDueToNav,
    setInputValue,
    inputFocused,
    setInputFocused,
    slashSelectedIndex,
    setSlashSelectedIndex,
    agentSelectedIndex,
    setAgentSelectedIndex,
    focusedAgentId,
    setFocusedAgentId,
    messages,
    setMessages,
    agentMode,
    setAgentMode,
    toggleAgentMode,
    isRetrying,
    pendingBashMessages,
    refs: {
      activeAgentStreamsRef,
      isChainInProgressRef,
      activeSubagentsRef,
      abortControllerRef,
      sendMessageRef,
    },
  } = useChatState()

  const data = useChatData()

  const pickers = useChatPickers({ inputRef, setInputFocused, setMessages })

  useChatBootstrap({
    messages,
    setMessages,
    sidebarModel: data.sidebarModel,
    updateContextTokensMax: data.updateContextTokensMax,
    initialMode,
    setAgentMode,
    initialPermissionMode,
  })

  // Use extracted chat messages hook for message tree and pagination
  const {
    messageTree,
    visibleTopLevelMessages,
    hiddenMessageCount,
    handleCollapseToggle,
    isUserCollapsing,
    handleLoadPreviousMessages,
    handleToggleAll,
  } = useChatMessages({ messages, setMessages })

  // Use extracted UI hook for scroll, terminal dimensions, and theme
  const {
    scrollRef,
    scrollToLatest,
    scrollUp,
    scrollDown,
    appliedScrollboxProps,
    isAtBottom,
    hasOverflow,
    terminalWidth,
    terminalHeight,
    separatorWidth,
    messageAvailableWidth,
    isCompactHeight,
    isNarrowWidth,
    theme,
    markdownPalette,
  } = useChatUI({ messages, isUserCollapsing })

  const header = useChatHeaderVisibility({
    scrollRef,
    messages,
    terminalHeight,
    terminalWidth,
  })

  const interactions = useChatInteractions({
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
    subscriptionData: data.subscriptionData,
    setIsAuthenticated,
    setUser,
    logoutMutation,
    showSuggestedPrompts,
    setShowSuggestedPrompts,
    fileTree,
    hasSubscription: data.hasSubscription,
    modelPickerOpen: pickers.modelPickerOpen,
    providerPickerOpen: pickers.providerPickerOpen,
    rewindPickerOpen: pickers.rewindPickerOpen,
  })

  const askUserState = useChatStore((state) => state.askUserState)

  return {
    messages,
    pendingBashMessages,
    inputValue,
    cursorPosition,
    lastEditDueToNav,
    setInputValue,
    inputFocused,
    inputRef,
    agentMode,
    toggleAgentMode,
    setAgentMode,
    slashSelectedIndex,
    agentSelectedIndex,
    isRetrying,
    showSuggestedPrompts,
    askUserState,
    data,
    pickers,
    messageTree,
    visibleTopLevelMessages,
    hiddenMessageCount,
    handleCollapseToggle,
    handleLoadPreviousMessages,
    handleToggleAll,
    ui: {
      scrollRef,
      scrollToLatest,
      scrollUp,
      scrollDown,
      appliedScrollboxProps,
      isAtBottom,
      hasOverflow,
      terminalWidth,
      terminalHeight,
      separatorWidth,
      messageAvailableWidth,
      isCompactHeight,
      isNarrowWidth,
      theme,
      markdownPalette,
    },
    header,
    interactions,
  }
}

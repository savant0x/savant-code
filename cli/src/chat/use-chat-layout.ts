/**
 * Second half of the chat composition root (FID-2026-0805-003). Consumes the
 * ChatControllerCore bundle and produces ChatLayoutProps: message-block store
 * sync, derived display values, and the flat prop mapping consumed by the
 * presentational layout.
 */

import { buildChatLayoutProps } from './build-chat-layout-props'
import { useChatDerived } from './use-chat-derived'
import { useMessageBlockSync } from './use-message-block-sync'

import type { ChatLayoutProps, ChatProps } from './types'
import type { ChatControllerCore } from './use-chat-controller'

export function useChatLayout(
  core: ChatControllerCore,
  props: ChatProps,
): ChatLayoutProps {
  const {
    inputValue,
    cursorPosition,
    messages,
    isRetrying,
    showSuggestedPrompts,
    askUserState,
    data,
    ui,
    interactions,
  } = core
  const { savantFreeSession, authStatus } = props

  const {
    terminalWidth,
    terminalHeight,
    messageAvailableWidth,
    isCompactHeight,
    isNarrowWidth,
    theme,
    markdownPalette,
    isAtBottom,
  } = ui
  const {
    statusMessage,
    subscriptionData,
    responseAds,
    showInlineAds,
    handleAdClick,
    handleAdImpression,
    handleResponseAdsNeeded,
  } = data
  const {
    inputMode,
    isConnected,
    showReconnectionMessage,
    timerStartTime,
    streamStatus,
    isWaitingForResponse,
    isStreaming,
    shouldShowQueuePreview,
    queuePreviewTitle,
    pausedQueueText,
    nextCtrlCWillExit,
    feedbackMode,
    handleMessageFeedback,
    handleCloseFeedback,
    reviewMode,
    publishMode,
    slashContext,
    mentionContext,
    slashSuggestionItems,
    agentSuggestionItems,
    fileSuggestionItems,
    inputWidth,
    handleBuildFast,
    handleBuildMax,
    handleBuildLite,
  } = interactions

  useMessageBlockSync({
    theme,
    markdownPalette,
    messageTree: core.messageTree,
    isWaitingForResponse,
    timerStartTime,
    messageAvailableWidth,
    responseAds,
    showInlineAds,
    handleCollapseToggle: core.handleCollapseToggle,
    handleBuildFast,
    handleBuildMax,
    handleBuildLite,
    handleMessageFeedback,
    handleCloseFeedback,
    handleAdClick,
    handleAdImpression,
    handleResponseAdsNeeded,
  })

  const derived = useChatDerived({
    inputValue,
    cursorPosition,
    inputMode,
    messages,
    isStreaming,
    isWaitingForResponse,
    feedbackMode,
    publishMode,
    reviewMode,
    askUserState,
    showSuggestedPrompts,
    slashContext,
    mentionContext,
    slashSuggestionItems,
    agentSuggestionItems,
    fileSuggestionItems,
    statusMessage,
    streamStatus,
    nextCtrlCWillExit,
    isConnected,
    authStatus,
    showReconnectionMessage,
    isRetrying,
    queuePreviewTitle,
    pausedQueueText,
    shouldShowQueuePreview,
    isAtBottom,
    savantFreeSession,
    subscriptionData,
    inputWidth,
    terminalHeight,
    terminalWidth,
    isCompactHeight,
    isNarrowWidth,
  })

  return buildChatLayoutProps(core, props, derived)
}

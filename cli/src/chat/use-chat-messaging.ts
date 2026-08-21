/**
 * Messaging pipeline for the chat screen (FID-2026-0805-003). Extracted from
 * chat.tsx verbatim: streaming state, the send-message lifecycle, the /loop
 * scheduler, pending-bash flushing, prompt submission, and onboarding-prompt
 * retirement. Produces onSubmitPrompt consumed by overlays/suggestions/keyboard.
 */

import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { useChatPendingBashFlush } from './use-chat-pending-bash-flush'
import { extractDrivePlanDirective } from '../commands/auto-drive'
import { routeUserPrompt } from '../commands/router'
import { createLoopRunHandler } from '../hooks/run-outcome'
import { useChatStreaming } from '../hooks/use-chat-streaming'
import { useEvent } from '../hooks/use-event'
import { useLoopScheduler } from '../hooks/use-loop-scheduler'
import { useSendMessage } from '../hooks/use-send-message'
import { useChatStore } from '../state/chat-store'
import { trackEvent } from '../utils/analytics'
import { showClipboardMessage } from '../utils/clipboard'
import { logger } from '../utils/logger'
import { markFirstPromptSubmitted } from '../utils/settings'

import type { UseChatMessagingArgs } from './use-chat-messaging-types'
import type { SuggestedPromptSelection } from '../components/suggested-prompts'
import type { AgentMode } from '../utils/constants'

export type { UseChatMessagingArgs } from './use-chat-messaging-types'

export function useChatMessaging({
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
}: UseChatMessagingArgs) {
  // Use extracted streaming hook for connection, timer, queue, and exit handling
  const {
    isConnected,
    showReconnectionMessage,
    mainAgentTimer,
    timerStartTime,
    streamStatus,
    isWaitingForResponse,
    isStreaming,
    setStreamStatus,
    queuedMessages,
    queuePaused,
    streamMessageIdRef,
    addToQueue,
    addToQueueFront,
    stopStreaming,
    setCanProcessQueue,
    pauseQueue,
    resumeQueue,
    clearQueue,
    isQueuePausedRef,
    isProcessingQueueRef,
    queuedCount,
    shouldShowQueuePreview,
    queuePreviewTitle,
    pausedQueueText,
    inputPlaceholder,
    handleCtrlC,
    ensureQueueActiveBeforeSubmit,
    nextCtrlCWillExit,
  } = useChatStreaming({
    agentMode,
    inputValue,
    setInputValue,
    terminalWidth,
    separatorWidth,
    isChainInProgressRef,
    activeAgentStreamsRef,
    sendMessageRef,
  })

  useChatPendingBashFlush({
    isStreaming,
    streamMessageIdRef,
    isChainInProgressRef,
    pendingBashMessages,
    setMessages,
  })

  const { sendMessage, clearMessages } = useSendMessage({
    inputRef,
    activeSubagentsRef,
    isChainInProgressRef,
    setStreamStatus,
    setCanProcessQueue,
    abortControllerRef,
    agentId,
    onBeforeMessageSend: validateAgents,
    mainAgentTimer,
    scrollToLatest,
    onTimerEvent: () => {},
    isQueuePausedRef,
    isProcessingQueueRef,
    resumeQueue,
    requeueMessageAtFront: addToQueueFront,
    continueChat,
    continueChatId,
    subscriptionData,
  })

  sendMessageRef.current = sendMessage

  // FID-2026-0818-002: when an Auto Drive planning turn completes, detect the
  // `<drive-plan>` directive the model emitted and present the operator
  // Confirmation. Only fires on a true streaming → idle transition while the
  // drive is still in `planning`, so a Revision loop re-detects the updated
  // plan on the next completion.
  const driveState = useChatStore((state) => state.driveState)
  const wasStreamingRef = useRef(false)
  useEffect(() => {
    const finished = wasStreamingRef.current && !isStreaming
    wasStreamingRef.current = isStreaming
    if (!finished || driveState !== 'planning') return
    const lastAi = [...messages].reverse().find((m) => m.variant === 'ai')
    if (!lastAi) return
    const directive = extractDrivePlanDirective(lastAi.content)
    if (!directive) return
    useChatStore.getState().setDrivePlanDraft(directive)
    useChatStore.getState().setDriveState('awaiting_confirmation')
  }, [isStreaming, driveState, messages])

  // FID-2026-0726-001: mount the loop scheduler so /loop cadence actually
  // recurs. The callback re-submits the loop prompt using the current agentMode.
  useLoopScheduler(
    useCallback(createLoopRunHandler(sendMessage, agentMode), [
      sendMessage,
      agentMode,
    ]),
  )

  const onSubmitPrompt = useEvent(
    async (
      content: string,
      mode: AgentMode,
      options?: { preserveInputValue?: boolean },
    ) => {
      ensureQueueActiveBeforeSubmit()

      const preserveInput = options?.preserveInputValue === true
      const previousInputValue = preserveInput
        ? (() => {
            const {
              inputValue: text,
              cursorPosition,
              lastEditDueToNav,
            } = useChatStore.getState()
            return { text, cursorPosition, lastEditDueToNav }
          })()
        : null

      // Preserve attachments if needed (inline logic to avoid abstraction overhead)
      const preservedAttachments = preserveInput
        ? (() => {
            const items = useChatStore.getState().pendingAttachments
            if (items.length > 0) {
              useChatStore.getState().clearPendingAttachments()
              return [...items]
            }
            return null
          })()
        : null

      try {
        const result = await routeUserPrompt({
          abortControllerRef,
          agentMode: mode,
          inputRef,
          inputValue: content,
          isChainInProgressRef,
          isStreaming,
          logoutMutation,
          streamMessageIdRef,
          addToQueue,
          clearMessages,
          saveToHistory,
          scrollToLatest,
          sendMessage,
          setCanProcessQueue,
          setInputFocused,
          setInputValue,
          setIsAuthenticated,
          setMessages,
          setUser,
          stopStreaming,
        })

        return result
      } finally {
        if (previousInputValue) {
          setInputValue({
            text: previousInputValue.text,
            cursorPosition: previousInputValue.cursorPosition,
            lastEditDueToNav: previousInputValue.lastEditDueToNav,
          })
        }

        // Restore attachments if they were preserved and none have been added since
        if (
          preservedAttachments &&
          useChatStore.getState().pendingAttachments.length === 0
        ) {
          useChatStore.setState((state) => {
            state.pendingAttachments = preservedAttachments
          })
        }
      }
    },
  )

  // Retire onboarding suggested prompts only after the user submits a prompt.
  // Provider guidance is a system message and must not count as submission.
  // FID-007 D6: memoize the O(n) scan — it was re-run over the whole
  // transcript on every render.
  const hasSubmittedPrompt = useMemo(
    () => messages.some((message) => message.variant === 'user'),
    [messages],
  )
  useEffect(() => {
    if (showSuggestedPrompts && hasSubmittedPrompt) {
      markFirstPromptSubmitted()
      setShowSuggestedPrompts(false)
    }
  }, [showSuggestedPrompts, hasSubmittedPrompt])

  // Submit a suggested onboarding prompt as if the user had typed and sent it
  const handleSelectSuggestedPrompt = useEvent(
    (prompt: string, selection: SuggestedPromptSelection) => {
      trackEvent(AnalyticsEvent.SUGGESTED_PROMPT_CLICKED, {
        label: selection.label,
        index: selection.index,
        promptLength: prompt.length,
        agentMode,
      })
      onSubmitPrompt(prompt, agentMode).catch((error) => {
        logger.error({ error }, '[suggested-prompt] Failed to submit prompt')
        showClipboardMessage('Failed to send prompt', { durationMs: 3000 })
      })
    },
  )

  return {
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
    sendMessage,
  }
}

import { useCallback, useEffect, useRef } from 'react'

import { setCurrentChatId } from '../project-files'
import { createStreamController } from './stream-state'
import { useActiveSubagents } from './use-active-subagents'
import { useChatStore } from '../state/chat-store'
import { createStalledResetWatcher } from '../utils/finish-logic'
import { loadMostRecentChatState } from '../utils/run-state-storage'
import { sanitizeRestoredMessages } from '../utils/send-message-helpers'
import { prepareUserMessage as prepareUserMessageHelper } from './helpers/send-message'
import { createSendMessageBody } from './helpers/send-message-fn'

import type { UseSendMessageOptions } from './use-send-message-options'
import type { ChatMessage } from '../types/chat'
import type { SendMessageFn } from '../types/contracts/send-message'
import type { PendingAttachment } from '../types/store'
import type { AgentMode } from '../utils/constants'
import type { RunState } from '@savant-code/sdk'

export const useSendMessage = ({
  inputRef,
  activeSubagentsRef,
  isChainInProgressRef,
  setStreamStatus,
  setCanProcessQueue,
  abortControllerRef,
  agentId,
  onBeforeMessageSend,
  mainAgentTimer,
  scrollToLatest,
  onTimerEvent = () => {},
  isQueuePausedRef,
  isProcessingQueueRef,
  resumeQueue,
  requeueMessageAtFront,
  continueChat,
  continueChatId,
}: UseSendMessageOptions): {
  sendMessage: SendMessageFn
  clearMessages: () => void
} => {
  // Pull setters directly from store - these are stable references that don't need
  // to trigger re-renders, so using getState() outside of callbacks is intentional.
  const {
    setMessages,
    setFocusedAgentId,
    setInputFocused,
    setStreamingAgents,
    setActiveSubagents,
    setIsChainInProgress,
    setHasReceivedPlanResponse,
    setLastMessageMode,
    addSessionCredits,
    setRunState,
    setIsRetrying,
  } = useChatStore.getState()
  const previousRunStateRef = useRef<RunState | null>(
    useChatStore.getState().runState,
  )
  // Memoize stream controller to maintain referential stability across renders
  const streamRefsRef = useRef<ReturnType<
    typeof createStreamController
  > | null>(null)
  if (!streamRefsRef.current) {
    streamRefsRef.current = createStreamController()
  }
  const streamRefs = streamRefsRef.current

  // FID-2026-0718-010 (F3 + D5): heartbeat timer ref + stalled-state watcher.
  // Started before client.run, stopped in finally block. Heartbeat polls
  // the live snapshot every 2s for token counts; watcher polls every 5s
  // for 30s of chunk-silence + auto-reset.
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  )
  const stalledWatcher = createStalledResetWatcher()

  useEffect(() => {
    if (continueChat && !previousRunStateRef.current) {
      const loadedState = loadMostRecentChatState(continueChatId ?? undefined)
      if (loadedState) {
        previousRunStateRef.current = loadedState.runState
        setRunState(loadedState.runState)
        setMessages(sanitizeRestoredMessages(loadedState.messages))
        if (loadedState.chatId) {
          setCurrentChatId(loadedState.chatId)
        }
      }
    }
  }, [continueChat, continueChatId, setMessages, setRunState])

  const updateChainInProgress = useCallback(
    (value: boolean) => {
      isChainInProgressRef.current = value
      setIsChainInProgress(value)
    },
    [setIsChainInProgress, isChainInProgressRef],
  )

  const { addActiveSubagent, removeActiveSubagent } = useActiveSubagents(
    activeSubagentsRef,
    setActiveSubagents,
  )

  function clearMessages() {
    previousRunStateRef.current = null
    setRunState(null)
  }

  const prepareUserMessage = useCallback(
    (params: {
      content: string
      agentMode: AgentMode
      postUserMessage?: (prev: ChatMessage[]) => ChatMessage[]
      attachments?: PendingAttachment[]
    }) => {
      // Access lastMessageMode fresh each call to get current value
      const { lastMessageMode } = useChatStore.getState()
      return prepareUserMessageHelper({
        ...params,
        deps: {
          setMessages,
          lastMessageMode,
          setLastMessageMode,
          scrollToLatest,
          setHasReceivedPlanResponse,
        },
      })
    },
    [
      setMessages,
      setLastMessageMode,
      scrollToLatest,
      setHasReceivedPlanResponse,
    ],
  )

  const sendMessage = useCallback(
    createSendMessageBody({
      inputRef,
      isChainInProgressRef,
      setStreamStatus,
      setCanProcessQueue,
      abortControllerRef,
      isQueuePausedRef,
      isProcessingQueueRef,
      setMessages,
      setFocusedAgentId,
      setInputFocused,
      setStreamingAgents,
      setHasReceivedPlanResponse,
      addSessionCredits,
      setRunState,
      setIsRetrying,
      previousRunStateRef,
      streamRefs,
      heartbeatIntervalRef,
      stalledWatcher,
      updateChainInProgress,
      addActiveSubagent,
      removeActiveSubagent,
      prepareUserMessage,
      agentId,
      onBeforeMessageSend,
      mainAgentTimer,
      scrollToLatest,
      onTimerEvent,
      resumeQueue,
      requeueMessageAtFront,
    }),
    [
      addActiveSubagent,
      addSessionCredits,
      agentId,
      inputRef,
      isChainInProgressRef,
      isProcessingQueueRef,
      isQueuePausedRef,
      mainAgentTimer,
      onBeforeMessageSend,
      onTimerEvent,
      prepareUserMessage,
      removeActiveSubagent,
      requeueMessageAtFront,
      resumeQueue,
      scrollToLatest,
      setCanProcessQueue,
      setFocusedAgentId,
      setHasReceivedPlanResponse,
      setInputFocused,
      setIsRetrying,
      setMessages,
      setRunState,
      setStreamStatus,
      setStreamingAgents,
      streamRefs,
      updateChainInProgress,
    ],
  )

  return {
    sendMessage,
    clearMessages,
  }
}

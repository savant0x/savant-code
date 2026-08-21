import { setupStreamingContext } from './send-message'
import {
  prepareUserMessageForSend,
  validateBeforeSend,
  type QueueResetDeps,
} from './send-message-failure'
import { createRunLifecycle } from './send-message-lifecycle'
import {
  enforceSavantFreeSession,
  initSavantCodeClientForSend,
} from './send-message-session'
import { useChatStore } from '../../state/chat-store'
import { logger } from '../../utils/logger'
import {
  autoCollapsePreviousMessages,
  createAiMessageShell,
  generateAiMessageId,
} from '../../utils/send-message-helpers'
import { createSendMessageTimerController } from '../../utils/send-message-timer'

import type { SendMessageFn } from '../../types/contracts/send-message'
import type { CreateSendMessageBodyParams } from '../use-send-message-options'

type SendRunArgs = Parameters<SendMessageFn>[0]

/** Everything the pre-stream preparation phase reads from the send body. */
interface PrepareSendRunContext {
  reportRunOutcome: (outcome: 'success' | 'failure') => void
  requeueMessageAtFront: CreateSendMessageBodyParams['requeueMessageAtFront']
  queueReset: QueueResetDeps
  setHasReceivedPlanResponse: CreateSendMessageBodyParams['setHasReceivedPlanResponse']
  mainAgentTimer: CreateSendMessageBodyParams['mainAgentTimer']
  onTimerEvent: NonNullable<CreateSendMessageBodyParams['onTimerEvent']>
  agentId: CreateSendMessageBodyParams['agentId']
  setIsRetrying: CreateSendMessageBodyParams['setIsRetrying']
  prepareUserMessage: CreateSendMessageBodyParams['prepareUserMessage']
  setMessages: CreateSendMessageBodyParams['setMessages']
  onBeforeMessageSend: CreateSendMessageBodyParams['onBeforeMessageSend']
  scrollToLatest: CreateSendMessageBodyParams['scrollToLatest']
  setFocusedAgentId: CreateSendMessageBodyParams['setFocusedAgentId']
  setInputFocused: CreateSendMessageBodyParams['setInputFocused']
  inputRef: CreateSendMessageBodyParams['inputRef']
  streamRefs: CreateSendMessageBodyParams['streamRefs']
  abortControllerRef: CreateSendMessageBodyParams['abortControllerRef']
  setStreamStatus: CreateSendMessageBodyParams['setStreamStatus']
  setCanProcessQueue: CreateSendMessageBodyParams['setCanProcessQueue']
  isQueuePausedRef: CreateSendMessageBodyParams['isQueuePausedRef']
  isProcessingQueueRef: CreateSendMessageBodyParams['isProcessingQueueRef']
  updateChainInProgress: CreateSendMessageBodyParams['updateChainInProgress']
  setStreamingAgents: CreateSendMessageBodyParams['setStreamingAgents']
  previousRunStateRef: CreateSendMessageBodyParams['previousRunStateRef']
  setRunState: CreateSendMessageBodyParams['setRunState']
  content: SendRunArgs['content']
  agentMode: SendRunArgs['agentMode']
  postUserMessage: SendRunArgs['postUserMessage']
  attachments: SendRunArgs['attachments']
}

/**
 * The pre-stream preparation phase of the send body (FID-2026-0819-005
 * Loop 132): SavantFree guard, user-message preparation, validation, focus/
 * FSM reset, client init, streaming context, AI message shell, and run
 * lifecycle open. Returns null when any guard bailed — the caller must
 * return without streaming. Behavior is identical to the inlined sequence
 * this was moved from; every statement is executed in the same order.
 */
export const prepareSendRun = async (ctx: PrepareSendRunContext) => {
  const {
    reportRunOutcome,
    requeueMessageAtFront,
    queueReset,
    setHasReceivedPlanResponse,
    mainAgentTimer,
    onTimerEvent,
    agentId,
    setIsRetrying,
    prepareUserMessage,
    setMessages,
    onBeforeMessageSend,
    scrollToLatest,
    setFocusedAgentId,
    setInputFocused,
    inputRef,
    streamRefs,
    abortControllerRef,
    setStreamStatus,
    setCanProcessQueue,
    isQueuePausedRef,
    isProcessingQueueRef,
    updateChainInProgress,
    setStreamingAgents,
    previousRunStateRef,
    setRunState,
    content,
    agentMode,
    postUserMessage,
    attachments,
  } = ctx

  // SavantFree run-start guard: without a live session slot the server
  // rejects the request outright, consuming the message. It is held at the
  // head of the queue instead and resumes when the user rejoins from the
  // session-ended banner (see enforceSavantFreeSession).
  if (
    !enforceSavantFreeSession({
      reportRunOutcome,
      requeueMessageAtFront,
      content,
      attachments,
      queueReset,
    })
  ) {
    return null
  }

  setHasReceivedPlanResponse(false)

  // Initialize timer for elapsed time tracking
  const timerController = createSendMessageTimerController({
    mainAgentTimer,
    onTimerEvent,
    agentId,
  })
  setIsRetrying(false)

  // Prepare user message (bash context, images, text attachments, mode divider)
  const prepared = await prepareUserMessageForSend({
    prepareUserMessage,
    content,
    agentMode,
    postUserMessage,
    attachments,
    reportRunOutcome,
    logger,
    setMessages,
    queueReset,
  })
  if (!prepared) {
    return null
  }
  const { userMessageId, messageContent, bashContextForPrompt, finalContent } =
    prepared

  // Validate before sending (e.g., agent config checks)
  if (
    !(await validateBeforeSend({
      onBeforeMessageSend,
      userMessageId,
      setMessages,
      reportRunOutcome,
      logger,
      scrollToLatest,
      queueReset,
    }))
  ) {
    return null
  }

  // Reset UI focus state
  setFocusedAgentId(null)
  setInputFocused(true)
  inputRef.current?.focus()

  // Reset FSM phase to idle on new user message (FID-2026-0718-008 Fix 9b)
  useChatStore.getState().onNewUserMessage()

  // Get SDK client (surfaces a branded error banner and resets chain/queue
  // state when the client can't be initialized).
  const client = await initSavantCodeClientForSend({
    reportRunOutcome,
    setMessages,
    scrollToLatest,
    queueReset,
  })
  if (!client) {
    return null
  }

  // Create AI message shell and setup streaming context
  const aiMessageId = generateAiMessageId()
  const aiMessage = createAiMessageShell(aiMessageId)

  const { updater, hasReceivedContentRef, abortController } =
    setupStreamingContext({
      aiMessageId,
      timerController,
      setMessages,
      streamRefs,
      abortControllerRef,
      setStreamStatus,
      setCanProcessQueue,
      isQueuePausedRef,
      isProcessingQueueRef,
      updateChainInProgress,
      setIsRetrying,
      setStreamingAgents,
    })
  setStreamStatus('waiting')
  // Combine auto-collapse and AI message addition into single atomic update
  // to prevent flicker from intermediate render states
  setMessages((prev) => [
    ...autoCollapsePreviousMessages(prev, aiMessageId),
    aiMessage,
  ])

  // Open this run's chat-directory lifecycle (checkpoint, live-state
  // provider, chat-switch aborter, initial checkpoint save).
  const runLifecycle = createRunLifecycle({
    previousRunStateRef,
    abortController,
    aiMessageId,
    finalContent,
    setRunState,
    setIsRetrying,
  })
  const { checkpointDir } = runLifecycle.start()

  return {
    client,
    updater,
    hasReceivedContentRef,
    abortController,
    aiMessageId,
    timerController,
    finalContent,
    messageContent,
    bashContextForPrompt,
    runLifecycle,
    checkpointDir,
  }
}

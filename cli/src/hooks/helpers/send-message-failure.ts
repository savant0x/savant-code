import { resetEarlyReturnState } from './send-message'
import { createErrorMessage as createErrorChatMessage } from '../../utils/send-message-helpers'
import { yieldToEventLoop } from '../../utils/yield-to-event-loop'

import type { ChatMessage } from '../../types/chat'
import type { PendingAttachment } from '../../types/store'
import type { AgentMode } from '../../utils/constants'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { MessageContent } from '@savant-code/sdk'
import type { MutableRefObject } from 'react'

/**
 * The chain/queue state a send releases on early return, shared by every
 * pre-stream failure path. Bundle avoids repeating the tuple at every call
 * site (FID-2026-0805-003).
 */
export type QueueResetDeps = {
  setCanProcessQueue: (can: boolean) => void
  updateChainInProgress: (value: boolean) => void
  isProcessingQueueRef?: MutableRefObject<boolean>
  isQueuePausedRef?: MutableRefObject<boolean>
}

export type ReportSendFailureParams = {
  setMessages: (update: (prev: ChatMessage[]) => ChatMessage[]) => void
  errorMessage: string
  /** When provided, the message list is scrolled after the event loop yields. */
  scrollToLatest?: () => void
  queueReset: QueueResetDeps
}

/**
 * Shows an error banner and releases the chain/queue state on an early return
 * (before streaming starts). Mirrors the inline failure plumbing in the
 * send-message hot path: banner, optional yield + scroll, then reset. The
 * scroll is scheduled after `yieldToEventLoop` exactly as the original blocks
 * did (`await yieldToEventLoop(); setTimeout(scroll, 0)`).
 */
export const reportSendFailure = async (
  params: ReportSendFailureParams,
): Promise<void> => {
  const { setMessages, errorMessage, scrollToLatest, queueReset } = params
  setMessages((prev) => [...prev, createErrorChatMessage(errorMessage)])
  if (scrollToLatest) {
    await yieldToEventLoop()
    setTimeout(() => scrollToLatest(), 0)
  }
  resetEarlyReturnState(queueReset)
}

type PrepareUserMessageFn = (params: {
  content: string
  agentMode: AgentMode
  postUserMessage?: (prev: ChatMessage[]) => ChatMessage[]
  attachments?: PendingAttachment[]
}) => Promise<{
  userMessageId: string
  messageContent: MessageContent[] | undefined
  bashContextForPrompt: string
  finalContent: string
}>

export type PrepareUserMessageForSendParams = {
  prepareUserMessage: PrepareUserMessageFn
  content: string
  agentMode: AgentMode
  postUserMessage?: (prev: ChatMessage[]) => ChatMessage[]
  attachments?: PendingAttachment[]
  reportRunOutcome: (outcome: 'success' | 'failure') => void
  logger: Logger
  setMessages: (update: (prev: ChatMessage[]) => ChatMessage[]) => void
  queueReset: QueueResetDeps
}

export type PreparedMessageContent = {
  userMessageId: string
  messageContent: MessageContent[] | undefined
  bashContextForPrompt: string
  finalContent: string
}

/**
 * Prepares the user message (bash context, images, text/file attachments,
 * mode divider). On failure, reports the outcome, shows a banner, releases
 * chain/queue state, and returns null so the send aborts. Extracted from
 * use-send-message.ts (FID-2026-0805-003).
 */
export const prepareUserMessageForSend = async (
  params: PrepareUserMessageForSendParams,
): Promise<PreparedMessageContent | null> => {
  const {
    prepareUserMessage,
    content,
    agentMode,
    postUserMessage,
    attachments,
    reportRunOutcome,
    logger: runLogger,
  } = params
  try {
    return await prepareUserMessage({
      content,
      agentMode,
      postUserMessage,
      attachments,
    })
  } catch (error) {
    reportRunOutcome('failure')
    runLogger.error(
      { error },
      '[send-message] prepareUserMessage failed with exception',
    )
    await reportSendFailure({
      ...params,
      errorMessage: '⚠️ Failed to prepare message. Please try again.',
    })
    return null
  }
}

export type ValidateBeforeSendParams = {
  onBeforeMessageSend: () => Promise<{
    success: boolean
    errors: Array<{ id: string; message: string }>
  }>
  userMessageId: string
  setMessages: (update: (prev: ChatMessage[]) => ChatMessage[]) => void
  reportRunOutcome: (outcome: 'success' | 'failure') => void
  logger: Logger
  scrollToLatest: () => void
  queueReset: QueueResetDeps
}

/**
 * Runs the pre-send validation, surfacing validation errors on the user
 * message or a failure banner + state reset on exceptions. Returns false when
 * the send must abort. Extracted from use-send-message.ts (FID-2026-0805-003).
 */
export const validateBeforeSend = async (
  params: ValidateBeforeSendParams,
): Promise<boolean> => {
  const {
    onBeforeMessageSend,
    userMessageId,
    setMessages,
    reportRunOutcome,
    logger: runLogger,
  } = params
  try {
    const validationResult = await onBeforeMessageSend()

    if (!validationResult.success) {
      reportRunOutcome('failure')
      runLogger.warn(
        { errors: validationResult.errors },
        '[send-message] Validation failed',
      )
      const errorsToAttach =
        validationResult.errors.length === 0
          ? [
              // Hide this for now, as validate endpoint may be flaky and we don't want to bother users.
              // {
              //   id: NETWORK_ERROR_ID,
              //   message:
              //     'Agent validation failed. This may be due to a network issue or temporary server problem. Please try again.',
              // },
            ]
          : validationResult.errors

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== userMessageId) {
            return msg
          }
          return {
            ...msg,
            validationErrors: errorsToAttach,
          }
        }),
      )
      resetEarlyReturnState(params.queueReset)
      return false
    }
    return true
  } catch (error) {
    reportRunOutcome('failure')
    runLogger.error(
      { error },
      '[send-message] Validation before message send failed with exception',
    )

    await reportSendFailure({
      ...params,
      errorMessage:
        '⚠️ Agent validation failed unexpectedly. Please try again.',
    })
    return false
  }
}

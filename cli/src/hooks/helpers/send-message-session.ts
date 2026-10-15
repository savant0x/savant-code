import { resetEarlyReturnState } from './send-message'
import { reportSendFailure, type QueueResetDeps } from './send-message-failure'
import { IS_SAVANT_FREE } from '../../utils/constants'
import { logger } from '../../utils/logger'
import { getSavantCodeClient } from '../../utils/savant-code-client'
import {
  getSavantFreeInstanceId,
  markSavantFreeSessionEnded,
} from '../use-savant-free-session'

import type { ChatMessage } from '../../types/chat'
import type { PendingAttachment } from '../../types/store'
import type { SavantCodeClient } from '@savant-code/sdk'

/**
 * SavantFree run-start guard: without a live session slot the server rejects
 * the request outright, consuming the message. Returns false (and holds the
 * message at the head of the queue) when the session is unavailable; returns
 * true to proceed. Catches sends that bypass the queue's sendBlocked hold
 * (direct review-screen answers) and the dequeue race where the slot expires
 * between the queue's check and this call.
 */
export const enforceSavantFreeSession = (params: {
  reportRunOutcome: (outcome: 'success' | 'failure') => void
  requeueMessageAtFront?: (message: {
    content: string
    attachments: PendingAttachment[]
  }) => void
  content: string
  attachments?: PendingAttachment[]
  queueReset: QueueResetDeps
}): boolean => {
  const { reportRunOutcome, requeueMessageAtFront, content, attachments } =
    params
  if (!IS_SAVANT_FREE || getSavantFreeInstanceId()) {
    return true
  }
  reportRunOutcome('failure')
  markSavantFreeSessionEnded()
  requeueMessageAtFront?.({ content, attachments: attachments ?? [] })
  resetEarlyReturnState(params.queueReset)
  return false
}

/**
 * Initializes the SDK client for a send, surfacing a branded error banner and
 * resetting chain/queue state when the client is unavailable (init failure or
 * missing auth). Returns the client, or null when the send must abort.
 */
export const initSavantCodeClientForSend = async (params: {
  reportRunOutcome: (outcome: 'success' | 'failure') => void
  setMessages: (update: (prev: ChatMessage[]) => ChatMessage[]) => void
  scrollToLatest: () => void
  queueReset: QueueResetDeps
}): Promise<SavantCodeClient | null> => {
  const { reportRunOutcome } = params
  let client: SavantCodeClient | null = null
  try {
    client = await getSavantCodeClient()
  } catch (error) {
    reportRunOutcome('failure')
    logger.error(
      { error },
      '[send-message] Failed to initialize SavantCode client',
    )
    await reportSendFailure({
      ...params,
      errorMessage: `⚠️ Unable to connect to ${IS_SAVANT_FREE ? 'SavantFree' : 'SavantCode'}. Please check your authentication and try again.`,
    })
    return null
  }

  if (!client) {
    reportRunOutcome('failure')
    logger.error(
      {},
      '[send-message] No SavantCode client available. Please ensure you are authenticated.',
    )
    // Show error to user instead of silently failing
    const brandName = IS_SAVANT_FREE ? 'SavantFree' : 'SavantCode'
    await reportSendFailure({
      ...params,
      errorMessage: `⚠️ Unable to connect to ${brandName}. Please check your authentication and try again.`,
    })
    return null
  }

  return client
}

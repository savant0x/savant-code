import { reportSendFailure, type QueueResetDeps } from './send-message-failure'
import { logger } from '../../utils/logger'
import { getSavantCodeClient } from '../../utils/savant-code-client'

import type { ChatMessage } from '../../types/chat'
import type { SavantCodeClient } from '@savant-code/sdk'

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
      errorMessage:
        '⚠️ Unable to connect to SavantCode. Please check your authentication and try again.',
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
    const brandName = 'SavantCode'
    await reportSendFailure({
      ...params,
      errorMessage: `⚠️ Unable to connect to ${brandName}. Please check your authentication and try again.`,
    })
    return null
  }

  return client
}

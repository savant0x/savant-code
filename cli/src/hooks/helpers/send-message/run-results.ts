import { getErrorObject } from '@savant-code/common/util/error'

import { appendHint, quotaHint, rateLimitHint } from './fallback-hints'
import { finalizeQueueState } from './queue-state'
import { handleSavantFreeGateError, isRateLimited } from './run-result-gates'
import { IS_SAVANT_FREE } from '../../../utils/constants'
import {
  getCountryBlockFromFreeModeError,
  getFreeModeUnavailableErrorMessage,
  getSavantFreeGateErrorKind,
  getSavantFreeRateLimitErrorMessage,
  isOutOfCreditsError,
  isFreeModeUnavailableError,
  providerOutOfCreditsError,
} from '../../../utils/error-handling'
import { formatElapsedTime } from '../../../utils/format-elapsed-time'
import { logger } from '../../../utils/logger'
import { markSavantFreeSessionCountryBlocked } from '../../use-savant-free-session'

import type { AgentMode } from '../../../utils/constants'
import type { BatchedMessageUpdater } from '../../../utils/message-updater'
import type { SendMessageTimerController } from '../../../utils/send-message-timer'
import type { StreamStatus } from '../../use-message-queue'
import type { RunState } from '@savant-code/sdk'
import type { MutableRefObject } from 'react'

const DEFAULT_RUN_OUTPUT_ERROR_MESSAGE = 'No output from agent run'

export const handleRunCompletion = (params: {
  runState: RunState
  actualCredits: number | undefined
  agentMode: AgentMode
  timerController: SendMessageTimerController
  updater: BatchedMessageUpdater
  aiMessageId: string
  wasAbortedByUser: boolean
  /** Whether the run streamed any content before finishing. A savant-free gate
   *  rejection with no content means the prompt was consumed unprocessed —
   *  surfaced as an inline error instead of silently looking sent. */
  hasReceivedContent?: boolean
  setStreamStatus: (status: StreamStatus) => void
  setCanProcessQueue: (can: boolean) => void
  updateChainInProgress: (value: boolean) => void
  setHasReceivedPlanResponse: (value: boolean) => void
  resumeQueue?: () => void
  isProcessingQueueRef?: MutableRefObject<boolean>
  isQueuePausedRef?: MutableRefObject<boolean>
  /** FID-2026-0915-001 (W5): keys the 429 fallback hint. */
  effectiveModelId?: string
}) => {
  const {
    runState,
    actualCredits,
    agentMode: _agentMode,
    timerController,
    updater,
    wasAbortedByUser,
    setStreamStatus,
    setCanProcessQueue,
    updateChainInProgress,
    setHasReceivedPlanResponse: _setHasReceivedPlanResponse,
    resumeQueue,
    isProcessingQueueRef,
    isQueuePausedRef,
  } = params
  // If user aborted, the abort handler already handled UI updates and released the
  // chain lock. Don't finalize queue state again to avoid interfering with any new
  // run that may have started after the abort. Uses per-run abort signal (not shared
  // streamRefs) so a newer run's reset() can't clear this flag.
  if (wasAbortedByUser) {
    return
  }
  const output = runState.output
  const finalizeAfterError = () => {
    finalizeQueueState({
      setStreamStatus,
      setCanProcessQueue,
      updateChainInProgress,
      isProcessingQueueRef,
      isQueuePausedRef,
    })
    timerController.stop('error')
  }
  if (!output) {
    if (!wasAbortedByUser) {
      updater.setError(DEFAULT_RUN_OUTPUT_ERROR_MESSAGE)
      finalizeAfterError()
    }
    return
  }
  if (output.type === 'error') {
    if (isOutOfCreditsError(output)) {
      // FID-2026-0929-005 (gut the backend): the backend-mode 402 branch is
      // deleted — a 402 is always the provider's own account state via the
      // direct lane. The provider's payload explains itself; no input-mode
      // lockout, no billing message, no usage poll.
      updater.setError(
        appendHint(
          providerOutOfCreditsError(output, process.env.DIRECT_PROVIDER),
          quotaHint({
            error: output,
            modelId: params.effectiveModelId,
            providerId: process.env.DIRECT_PROVIDER,
          }),
        ),
      )
      finalizeAfterError()
      return
    }
    // FID-2026-0915-001 (W5): a rate-limited run offers same-family free
    // alternatives (fail-silent; '' ⇒ banner unchanged).
    const rateLimitHint429 = rateLimitHint({
      error: output,
      modelId: params.effectiveModelId,
    })
    if (isFreeModeUnavailableError(output)) {
      updater.setError(getFreeModeUnavailableErrorMessage(output))
      if (IS_SAVANT_FREE) {
        markSavantFreeSessionCountryBlocked(
          getCountryBlockFromFreeModeError(output) ?? {
            countryCode: 'UNKNOWN',
          },
        )
      }
      finalizeAfterError()
      return
    }
    const gateKind = getSavantFreeGateErrorKind(output)
    if (gateKind) {
      handleSavantFreeGateError(gateKind, updater, {
        messageWasDropped: params.hasReceivedContent === false,
      })
      finalizeAfterError()
      return
    }
    const rateLimitMsg = IS_SAVANT_FREE
      ? getSavantFreeRateLimitErrorMessage(output)
      : null
    if (rateLimitMsg) {
      updater.setError(appendHint(rateLimitMsg, rateLimitHint429))
      finalizeAfterError()
      return
    }
    // Pass the raw error message to setError (displayed in UserErrorBanner without additional wrapper formatting)
    const completionErrorMessage =
      output.message ?? DEFAULT_RUN_OUTPUT_ERROR_MESSAGE
    // FID-2026-0919-026: a provider quota refusal explains itself — quote the
    // provider's declared note and point at /health for the live reading.
    const quotaHintText = quotaHint({
      error: output,
      modelId: params.effectiveModelId,
      providerId: process.env.DIRECT_PROVIDER,
    })
    updater.setError(
      appendHint(
        completionErrorMessage,
        isRateLimited(output) ? rateLimitHint429 : quotaHintText,
      ),
    )
    finalizeAfterError()
    return
  }
  finalizeQueueState({
    setStreamStatus,
    setCanProcessQueue,
    updateChainInProgress,
    isProcessingQueueRef,
    isQueuePausedRef,
    resumeQueue,
  })
  const timerResult = timerController.stop('success')
  const elapsedMs = timerResult?.elapsedMs ?? 0
  const elapsedSeconds = Math.floor(elapsedMs / 1000)
  let completionTime: string | undefined
  if (elapsedSeconds > 0) {
    completionTime = formatElapsedTime(elapsedSeconds)
  }
  updater.markComplete({
    ...(completionTime && { completionTime }),
    ...(actualCredits !== undefined && { credits: actualCredits }),
    metadata: {
      runState,
    },
  })
}

export const handleRunError = (params: {
  error: unknown
  timerController: SendMessageTimerController
  updater: BatchedMessageUpdater
  setIsRetrying: (value: boolean) => void
  setStreamStatus: (status: StreamStatus) => void
  setCanProcessQueue: (can: boolean) => void
  updateChainInProgress: (value: boolean) => void
  isProcessingQueueRef?: MutableRefObject<boolean>
  isQueuePausedRef?: MutableRefObject<boolean>
  /** See handleRunCompletion — flags an unprocessed prompt on gate errors. */
  hasReceivedContent?: boolean
  /** FID-2026-0915-001 (W5): keys the 429 fallback hint. */
  effectiveModelId?: string
}) => {
  const {
    error,
    timerController,
    updater,
    setIsRetrying,
    setStreamStatus,
    setCanProcessQueue,
    updateChainInProgress,
    isProcessingQueueRef,
    isQueuePausedRef,
    hasReceivedContent,
  } = params
  const errorInfo = getErrorObject(error, { includeRawError: true })
  logger.error({ error: errorInfo }, 'SDK client.run() failed')
  setIsRetrying(false)
  finalizeQueueState({
    setStreamStatus,
    setCanProcessQueue,
    updateChainInProgress,
    isProcessingQueueRef,
    isQueuePausedRef,
  })
  timerController.stop('error')
  if (isOutOfCreditsError(error)) {
    // FID-2026-0929-005 (gut the backend): direct providers own their 402s —
    // see handleRunCompletion. No backend branch survives to rewrite them.
    updater.setError(
      appendHint(
        providerOutOfCreditsError(error, process.env.DIRECT_PROVIDER),
        quotaHint({
          error,
          modelId: params.effectiveModelId,
          providerId: process.env.DIRECT_PROVIDER,
        }),
      ),
    )
    return
  }
  if (isFreeModeUnavailableError(error)) {
    updater.setError(getFreeModeUnavailableErrorMessage(error))
    if (IS_SAVANT_FREE) {
      markSavantFreeSessionCountryBlocked(
        getCountryBlockFromFreeModeError(error) ?? {
          countryCode: 'UNKNOWN',
        },
      )
    }
    return
  }
  const gateKind = getSavantFreeGateErrorKind(error)
  if (gateKind) {
    handleSavantFreeGateError(gateKind, updater, {
      messageWasDropped: hasReceivedContent === false,
    })
    return
  }
  // FID-2026-0915-001 (W5): a rate-limited run offers same-family free
  // alternatives (fail-silent; '' ⇒ banner unchanged).
  const w5Hint = rateLimitHint({
    error,
    modelId: params.effectiveModelId,
  })
  const rateLimitMsg = IS_SAVANT_FREE
    ? getSavantFreeRateLimitErrorMessage(error)
    : null
  if (rateLimitMsg) {
    updater.setError(appendHint(rateLimitMsg, w5Hint))
    return
  }
  // Use setError for all errors so they display in UserErrorBanner consistently
  const errorMessage = errorInfo.message || 'An unexpected error occurred'
  // FID-2026-0919-026: gateway quota refusals are account state, not defects.
  const quotaHintText = quotaHint({
    error,
    modelId: params.effectiveModelId,
    providerId: process.env.DIRECT_PROVIDER,
  })
  updater.setError(
    appendHint(errorMessage, isRateLimited(error) ? w5Hint : quotaHintText),
  )
}

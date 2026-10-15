import type { StreamStatus } from '../../use-message-queue'
import type { MutableRefObject } from 'react'

/** Resets queue state on early return (before streaming starts). */
export type ResetEarlyReturnStateParams = {
  setCanProcessQueue: (can: boolean) => void
  updateChainInProgress: (value: boolean) => void
  isProcessingQueueRef?: MutableRefObject<boolean>
  isQueuePausedRef?: MutableRefObject<boolean>
}

export const resetEarlyReturnState = (
  params: ResetEarlyReturnStateParams,
): void => {
  const {
    setCanProcessQueue,
    updateChainInProgress,
    isProcessingQueueRef,
    isQueuePausedRef,
  } = params
  updateChainInProgress(false)
  setCanProcessQueue(!isQueuePausedRef?.current)
  if (isProcessingQueueRef) {
    isProcessingQueueRef.current = false
  }
}

/** Resets queue state after streaming completes, aborts, or errors. */
export type FinalizeQueueStateParams = {
  setStreamStatus: (status: StreamStatus) => void
  setCanProcessQueue: (can: boolean) => void
  updateChainInProgress: (value: boolean) => void
  isProcessingQueueRef?: MutableRefObject<boolean>
  isQueuePausedRef?: MutableRefObject<boolean>
  resumeQueue?: () => void
}

export const finalizeQueueState = (params: FinalizeQueueStateParams): void => {
  const {
    setStreamStatus,
    setCanProcessQueue,
    updateChainInProgress,
    isProcessingQueueRef,
    isQueuePausedRef,
    resumeQueue,
  } = params
  setStreamStatus('idle')
  // Release lock here as part of normal completion flow.
  // Also released in finally block and .catch() as safety nets (idempotent).
  if (isProcessingQueueRef) {
    isProcessingQueueRef.current = false
  }
  if (resumeQueue) {
    resumeQueue()
  } else {
    setCanProcessQueue(!isQueuePausedRef?.current)
  }
  updateChainInProgress(false)
}

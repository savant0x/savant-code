import { handleRunError } from './send-message'
import { useChatStore } from '../../state/chat-store'
import { resetUiToIdle } from '../../utils/finish-logic'
import { logger } from '../../utils/logger'

import type { QueueResetDeps } from './send-message-failure'
import type { StalledResetWatcher } from '../../utils/finish-logic'
import type { BatchedMessageUpdater } from '../../utils/message-updater'
import type { SendMessageTimerController } from '../../utils/send-message-timer'
import type { StreamController } from '../stream-state'
import type { StreamStatus } from '../use-message-queue'
import type { MutableRefObject } from 'react'

export type FinalizeRunStreamingParams = {
  streamRefs: StreamController
  abortController: AbortController
  heartbeatIntervalRef: MutableRefObject<ReturnType<typeof setInterval> | null>
  stalledWatcher: StalledResetWatcher
  isChainInProgressRef: MutableRefObject<boolean>
  setStreamStatus: (status: StreamStatus) => void
  queueReset: QueueResetDeps
  updater: BatchedMessageUpdater
}

/**
 * The finally-block streaming cleanup for a send run: marks the run complete
 * (late-chunk race protection), fires the canonical end-of-stream reset,
 * stops heartbeat + stalled watcher, releases the chain lock as a safety net,
 * and disposes the batched updater. Extracted from use-send-message.ts
 * (FID-2026-0805-003). The lifecycle's finalize() handles the checkpoint +
 * provider teardown separately.
 */
export const finalizeRunStreaming = (
  params: FinalizeRunStreamingParams,
): void => {
  const {
    streamRefs,
    abortController,
    heartbeatIntervalRef,
    stalledWatcher,
    isChainInProgressRef,
    setStreamStatus,
    queueReset,
    updater,
  } = params

  // FID-2026-0718-010 (F2 + Q14): BEFORE clearing live state provider,
  // mark the run as completed so late-arriving chunks short-circuit.
  // Then fire the canonical end-of-stream reset. Order matters — the
  // snapshot must settle first, then the UI resets to idle.
  streamRefs.setters.setRunCompleted(true)
  if (!abortController.signal.aborted) {
    // Normal completion path: fire the canonical reset.
    useChatStore.getState().onStreamEnded('finish')
  } else {
    // Abort path: skip chain-lock release here (abort handler did it),
    // still reset FSM phase + activity to idle.
    resetUiToIdle('abort', { force: true })
  }

  // Stop the heartbeat + stalled watcher (FID-2026-0718-010 F3/D5).
  // Belt-and-braces: clear both named timers even if a previous run
  // didn't clean up. Idempotent — clearInterval/setTimeout nulls are
  // safe to call repeatedly.
  if (heartbeatIntervalRef.current) {
    clearInterval(heartbeatIntervalRef.current)
    heartbeatIntervalRef.current = null
  }
  stalledWatcher.stop()

  // If this run was aborted, the abort handler already released the chain lock
  // and queue processing state. Don't touch shared state here to avoid
  // interfering with any new run that may have started after the abort.
  // Uses per-run abortController.signal (not shared streamRefs) so a newer
  // run's reset() can't clear this flag.
  if (!abortController.signal.aborted) {
    if (isChainInProgressRef.current) {
      logger.warn(
        {},
        '[send-message] Chain still in progress after try/catch, forcing reset',
      )
      queueReset.updateChainInProgress(false)
      setStreamStatus('idle')
      queueReset.setCanProcessQueue(!queueReset.isQueuePausedRef?.current)
    }
    // Safety net: ensure lock is always released even if handleRunCompletion/handleRunError
    // didn't run (e.g., due to unexpected early return). Redundant releases are safe (idempotent).
    if (queueReset.isProcessingQueueRef) {
      queueReset.isProcessingQueueRef.current = false
    }
  }
  updater.dispose()
}

export type HandleRunCatchParams = {
  error: unknown
  abortController: AbortController
  reportRunOutcome: (outcome: 'success' | 'failure') => void
  timerController: SendMessageTimerController
  updater: BatchedMessageUpdater
  setIsRetrying: (value: boolean) => void
  setStreamStatus: (status: StreamStatus) => void
  queueReset: QueueResetDeps
  hasReceivedContent: boolean
  getRunChatIsCurrent: () => boolean
  persistFailureState: () => Promise<void>
  /** FID-2026-0915-001 (W5): keys the 429 fallback-hint lookup. */
  effectiveModelId?: string
}

/**
 * The catch-block for a send run: reports the failure, delegates to
 * handleRunError when the run wasn't aborted (aborts already cleaned up),
 * and persists the failure checkpoint when this run's chat is still current.
 * Extracted from use-send-message.ts (FID-2026-0805-003).
 */
export const handleRunCatch = async (
  params: HandleRunCatchParams,
): Promise<void> => {
  const {
    error,
    abortController,
    reportRunOutcome,
    timerController,
    updater,
    setIsRetrying,
    setStreamStatus,
    queueReset,
    hasReceivedContent,
    getRunChatIsCurrent,
    persistFailureState,
    effectiveModelId,
  } = params
  reportRunOutcome('failure')
  // If this run was aborted, the abort handler already handled cleanup.
  // Don't run error handling to avoid interfering with any new run that
  // may have started. Uses per-run abortController.signal (not shared
  // streamRefs) so a newer run's reset() can't clear this flag.
  if (!abortController.signal.aborted) {
    handleRunError({
      error,
      timerController,
      updater,
      setIsRetrying,
      setStreamStatus,
      ...queueReset,
      hasReceivedContent,
      effectiveModelId,
    })
    // Persist the last checkpoint plus the error banner so a restart
    // after a failed run still shows this turn (see persistFailureState).
    if (getRunChatIsCurrent()) {
      await persistFailureState()
    }
  } else {
    logger.debug({ error }, '[send-message] Ignoring error after abort')
  }
}

import {
  STATE_SNAPSHOT_INTERVAL_MS,
  STATE_SNAPSHOT_INTERRUPTION_MESSAGE,
} from '../types'

import type { RunState } from '../../run-state'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { SessionState } from '@savant-code/common/types/session-state'

/**
 * Periodic checkpoint emitter for in-flight runs. Emits once immediately, then
 * on a fixed interval until stopped or the signal aborts. The runtime replaces
 * mainAgentState.messageHistory with a new array at each step boundary, so
 * reference identity is a cheap "has anything durable changed" check — skipping
 * unchanged ticks avoids deep-cloning a potentially multi-MB sessionState every
 * interval while the run is just waiting on a slow LLM call.
 * (FID-2026-0809-016: extracted from `run/execution.ts`.)
 */
export function startStateSnapshotting(params: {
  sessionState: SessionState
  getCancelledRunState: (message: string) => RunState
  onStateSnapshot: (runState: RunState) => void
  signal?: AbortSignal
  logger?: Logger
}): {
  emit: () => void
  stop: () => void
} {
  const {
    sessionState,
    getCancelledRunState,
    onStateSnapshot,
    signal,
    logger,
  } = params

  let stopped = false
  let timer: ReturnType<typeof setInterval> | null = null
  let lastSnapshotHistory:
    SessionState['mainAgentState']['messageHistory'] | null = null
  // FID-2026-0814-006: the identity check must not be messageHistory-only.
  // Compaction status and the token count are observable, user-facing fields
  // written at boundaries that do not always coincide with a history identity
  // change (e.g. the pruner completion write, or a step-boundary percent
  // recompute) — so they join the "has anything durable changed" check to
  // keep the sidebar from showing a stale percent across LLM-call gaps.
  let lastSnapshotCompactionStatus: unknown = null
  let lastSnapshotContextTokenCount: number | null = null

  const emit = () => {
    if (stopped || signal?.aborted) {
      return
    }
    const agentState = sessionState.mainAgentState
    const history = agentState.messageHistory
    const compactionChanged =
      agentState.compactionStatus !== lastSnapshotCompactionStatus
    const tokenCountChanged =
      agentState.contextTokenCount !== lastSnapshotContextTokenCount
    if (
      history === lastSnapshotHistory &&
      !compactionChanged &&
      !tokenCountChanged
    ) {
      return
    }
    lastSnapshotHistory = history
    lastSnapshotCompactionStatus = agentState.compactionStatus
    lastSnapshotContextTokenCount = agentState.contextTokenCount
    try {
      onStateSnapshot(getCancelledRunState(STATE_SNAPSHOT_INTERRUPTION_MESSAGE))
    } catch (error) {
      logger?.debug?.(
        { error: error instanceof Error ? error.message : String(error) },
        'onStateSnapshot handler threw',
      )
    }
  }

  // Emit immediately so the user's prompt is checkpointed as soon as the
  // run starts, then keep checkpointing progress while it is in flight.
  emit()
  timer = setInterval(emit, STATE_SNAPSHOT_INTERVAL_MS)
  // Don't let the checkpoint timer keep the host process alive.
  const nodeTimer = timer as unknown as { unref?: () => void }
  if (typeof nodeTimer.unref === 'function') {
    nodeTimer.unref()
  }

  return {
    emit,
    stop: () => {
      stopped = true
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
    },
  }
}

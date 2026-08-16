import { randomUUID } from 'node:crypto'
import path from 'node:path'

import {
  STATE_SNAPSHOT_INTERRUPTION_MESSAGE,
  closeTurn,
  openTurn,
} from '@savant-code/sdk'

import { useChatStore } from '../../state/chat-store'
import { getSelectedSavantFreeModel } from '../../state/savant-free-model-store'
import {
  clearActiveRunAborter,
  setActiveRunAborter,
} from '../../utils/active-run'
import {
  clearLiveChatStateProvider,
  resolveCurrentChatDir,
  saveChatState,
  scheduleCheckpointSave,
  setLiveChatStateProvider,
  settleCheckpointSave,
} from '../../utils/run-state-storage'

import type { RunState } from '@savant-code/sdk'
import type { MutableRefObject } from 'react'

export type CreateRunLifecycleParams = {
  previousRunStateRef: MutableRefObject<RunState | null>
  abortController: AbortController
  aiMessageId: string
  finalContent: string
  setRunState: (state: RunState | null) => void
  setIsRetrying: (value: boolean) => void
}

export type RunLifecycle = {
  /** Resolves the run's chat dir, opens the turn checkpoint, registers the
   *  live-state provider + chat-switch aborter, and writes the initial
   *  checkpoint. Returns the checkpoint dir used by the run config. */
  start: () => { checkpointDir: string }
  /** True while this run's chat dir is still the active conversation. */
  getRunChatIsCurrent: () => boolean
  /** Periodic run-state snapshot: updates the internal snapshot, the sidebar
   *  token/cost meters, and coalesces an async checkpoint save. */
  onStateSnapshot: (snapshot: RunState) => void
  /** Adopts the completed run state and persists the authoritative final save. */
  adoptAndPersist: (runState: RunState) => Promise<void>
  /** Persists the last snapshot (plus error banner) after a failed run. */
  persistFailureState: () => Promise<void>
  /** Closes the turn checkpoint (async) and releases the live-state provider + aborter. */
  finalize: () => Promise<void>
  getLatestRunStateSnapshot: () => RunState
}

/**
 * Owns everything tied to a single send-run's chat-directory lifecycle:
 * checkpoint open/close (FID-2026-0803-004 rewind), live-state provider
 * registration, the chat-switch aborter, and all persistence saves. Extracted
 * from use-send-message.ts (FID-2026-0805-003) so the hook file stays under
 * the quality bar while the ordering-sensitive run lifecycle stays intact.
 */
export const createRunLifecycle = (
  params: CreateRunLifecycleParams,
): RunLifecycle => {
  const {
    previousRunStateRef,
    abortController,
    aiMessageId,
    finalContent,
    setRunState,
    setIsRetrying,
  } = params

  let runChatDir = ''
  let checkpointDir = ''
  let turnStartMessageCount = 0
  let turnStartHistoryLength = 0
  let latestRunStateSnapshot: RunState = previousRunStateRef.current ?? {
    traceSessionId: randomUUID(),
    output: {
      type: 'error',
      message: STATE_SNAPSHOT_INTERRUPTION_MESSAGE,
    },
  }

  const getRunChatIsCurrent = () => resolveCurrentChatDir() === runChatDir

  const start = () => {
    // Capture this run's chat directory once, up front. Every save for this
    // run targets this directory: the current chat id can rotate mid-run
    // (/new, resuming from /history), and resolving the dir at write time
    // would persist this run's state over a different chat's transcript.
    // After a switch the store's messages belong to the new conversation,
    // so persistence and state adoption below are gated on getRunChatIsCurrent.
    runChatDir = resolveCurrentChatDir()

    // FID-2026-0803-004: open this turn's persistent file checkpoint. The
    // runtime captures pre-write snapshots into checkpointDir keyed by
    // checkpointTurnId (the AI message id, shared by subagents), so /rewind
    // can restore every file this turn touched. Capture the conversation
    // boundary (CLI message count + SDK history length) BEFORE the run so
    // /rewind can also truncate the conversation back to turn start.
    checkpointDir = path.join(runChatDir, 'checkpoints')
    turnStartMessageCount = useChatStore.getState().messages.length
    turnStartHistoryLength =
      previousRunStateRef.current?.sessionState?.mainAgentState?.messageHistory
        ?.length ?? 0
    openTurn({
      checkpointDir,
      turnId: aiMessageId,
      prompt: finalContent,
      messageCount: turnStartMessageCount,
      historyLength: turnStartHistoryLength,
    })

    // Checkpoint the turn to disk immediately so that killing the process
    // (closed terminal, crash) can't lose the user's prompt, then keep the
    // checkpoint fresh from SDK run-state snapshots while the run streams.
    // The completion save below overwrites this with the final state.
    setLiveChatStateProvider(aiMessageId, () => ({
      runState: latestRunStateSnapshot,
      messages: useChatStore.getState().messages,
    }))

    // Let chat switches abort this run so it can't keep streaming (and
    // persisting) for a conversation the user has left.
    setActiveRunAborter(aiMessageId, () => {
      // Already aborted (e.g. Esc, or a second chat switch): don't schedule
      // again — the store may hold the next conversation's messages by now.
      if (abortController.signal.aborted) {
        return
      }
      abortController.abort()
      // The abort listener has synchronously finalized the streaming
      // message (interruption notice + markComplete), and the caller is
      // about to switch away from this chat. Queue one final checkpoint of
      // that exact state: periodic checkpoints only cover up to ~5s ago,
      // and the post-run save below won't fire once the chat has switched.
      // scheduleCheckpointSave captures the messages array by reference, so
      // the store reset that follows the switch can't affect the write.
      scheduleCheckpointSave(
        latestRunStateSnapshot,
        useChatStore.getState().messages,
        runChatDir,
      )
    })
    saveChatState(
      latestRunStateSnapshot,
      useChatStore.getState().messages,
      runChatDir,
      getSelectedSavantFreeModel(),
      false,
    )
    return { checkpointDir }
  }

  const onStateSnapshot = (snapshot: RunState) => {
    latestRunStateSnapshot = snapshot

    // Wire sidebar: update context tokens and cost in real time
    // from periodic snapshots (~every 5s) so the UI stays current
    // during long runs, not just at completion.
    const snapshotTokenCount =
      snapshot?.sessionState?.mainAgentState?.contextTokenCount
    if (typeof snapshotTokenCount === 'number') {
      useChatStore.getState().updateContextTokens(snapshotTokenCount)
    }
    const snapshotCost = snapshot?.sessionState?.mainAgentState?.creditsUsed
    if (typeof snapshotCost === 'number') {
      useChatStore.getState().updateSessionCost(snapshotCost)
    }

    // Don't persist once the run is aborted or the user has switched
    // chats: the store's messages then belong to a different
    // conversation, and checkpointing them into this run's directory
    // would overwrite that chat's transcript with foreign (possibly
    // empty) state — the chat would then be hidden from /history.
    if (abortController.signal.aborted || !getRunChatIsCurrent()) {
      return
    }
    // Persist asynchronously and coalescing: the periodic snapshot
    // fires ~every 5s at step boundaries, and a synchronous save of the
    // (growing) transcript on the render/input thread is what stalls
    // long sessions. The authoritative synchronous saves below still
    // capture the final state.
    scheduleCheckpointSave(
      snapshot,
      useChatStore.getState().messages,
      runChatDir,
    )
  }

  const adoptAndPersist = async (runState: RunState) => {
    // Finalize: persist state and mark complete
    previousRunStateRef.current = runState
    setRunState(runState)
    setIsRetrying(false)

    // Wire sidebar: update context tokens from agent state
    const contextTokenCount =
      runState?.sessionState?.mainAgentState?.contextTokenCount
    if (typeof contextTokenCount === 'number') {
      useChatStore.getState().updateContextTokens(contextTokenCount)
    }

    // Drop any queued/in-flight async checkpoint first so a stale write
    // can't land after this authoritative final save.
    await settleCheckpointSave()
    // Read committed state rather than saving inside a setMessages
    // updater: the store uses immer, so the updater sees a draft proxy
    // and JSON.stringify of the (unbounded) transcript through proxy
    // traps is several times slower.
    saveChatState(
      runState,
      useChatStore.getState().messages,
      runChatDir,
      getSelectedSavantFreeModel(),
    )
  }

  const persistFailureState = async () => {
    // Persist the last checkpoint plus the error banner so a restart
    // after a failed run still shows this turn. Settle async checkpoints
    // first so a stale write can't clobber this one. Skipped after a
    // mid-run chat switch — the store's messages belong to the new chat.
    await settleCheckpointSave()
    saveChatState(
      latestRunStateSnapshot,
      useChatStore.getState().messages,
      runChatDir,
      getSelectedSavantFreeModel(),
      false,
    )
  }

  const finalize = async () => {
    // FID-2026-0803-004: close this turn's checkpoint so its JSON is
    // persisted (and retention pruned) even on abort/error. Safe to call
    // unconditionally — closeTurn no-ops when the turn wasn't opened.
    // FID-2026-0815-005 (F-04): closeTurn is now async; awaited here so the
    // persistence settles before the provider/aborter release below.
    await closeTurn({
      checkpointDir,
      turnId: aiMessageId,
      prompt: finalContent,
      messageCount: turnStartMessageCount,
      historyLength: turnStartHistoryLength,
    })

    // Stop exit-flushing this run's checkpoint; the final state (or last
    // checkpoint, on error) has been saved above. Owner-guarded so an
    // aborted run resolving late can't clear a newer run's provider.
    clearLiveChatStateProvider(aiMessageId)
    clearActiveRunAborter(aiMessageId)
  }

  return {
    start,
    getRunChatIsCurrent,
    onStateSnapshot,
    adoptAndPersist,
    persistFailureState,
    finalize,
    getLatestRunStateSnapshot: () => latestRunStateSnapshot,
  }
}

import { createStore } from 'zustand/vanilla'

import {
  applyEvent,
  applyEventBatch,
  initialTranscriptState,
  noticeLine,
} from './transcript-reducer'

import type {
  ChatBlock,
  PersistedTranscriptMessage,
  TranscriptState,
  WorkspaceThread,
} from './transcript-types'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

// FID-2026-0819-005 Loop 298: zustand vanilla store + imperative helpers.
// This file remains the single public import path (types and the pure
// reducer are re-exported below), so consumer imports are unchanged.

export { formatToolOutput } from './transcript-format'
export { applyEventBatch, initialTranscriptState } from './transcript-reducer'
export type { RosterEntry } from './roster'
export type {
  AutoDriveHaltState,
  ChatBlock,
  CompactionStatus,
  CurrentActivity,
  FidQueueEntry,
  FidQueueStatus,
  PersistedTranscriptMessage,
  TranscriptState,
  WorkspaceThread,
} from './transcript-types'

export const transcriptStore = createStore<TranscriptState>()(
  () => initialTranscriptState,
)

export function ingestEvents(events: PrintModeEvent[]): void {
  transcriptStore.setState((state) => applyEventBatch(state, events))
}

/** Append a client-originated error line (connection failures etc.). */
export function pushLocalError(message: string): void {
  transcriptStore.setState((state) =>
    applyEvent(state, { type: 'error', message }),
  )
}

/**
 * Optimistically append the operator's own message to the thread. The
 * gateway protocol has no user-message echo event, so without this local
 * append the operator's side of the conversation is invisible.
 */
export function pushLocalUserMessage(text: string): void {
  transcriptStore.setState((state) => ({
    ...state,
    blocks: [
      ...state.blocks,
      {
        kind: 'user',
        id: state.blocks.length,
        text,
        ts: Date.now(),
      },
    ],
  }))
}

/**
 * True while a run is in-flight but no assistant-side output has appeared
 * since the operator's message — the "typing" window between send and the
 * first streamed block (text/reasoning/tool/notice all count as output).
 * Drives the chat thread's typing indicator; pure so it is testable.
 */
export function isAwaitingFirstOutput(
  blocks: ChatBlock[],
  running: boolean,
): boolean {
  if (!running) return false
  const last = blocks[blocks.length - 1]
  return last === undefined || last.kind === 'user'
}

/** Reset the transcript to its initial state (operator /clear command). */
export function clearTranscript(): void {
  transcriptStore.setState(() => initialTranscriptState)
}

/** Replace chat blocks with persisted messages for the selected workspace scope. */
export function setWorkspaceThreads(threads: WorkspaceThread[]): void {
  transcriptStore.setState((state) => ({ ...state, workspaceThreads: threads }))
}

export function updateWorkspaceThread(
  sessionId: string,
  stateUpdate: { unread?: boolean; pinned?: boolean },
): void {
  transcriptStore.setState((state) => ({
    ...state,
    workspaceThreads: state.workspaceThreads.map((thread) =>
      thread.sessionId === sessionId ? { ...thread, ...stateUpdate } : thread,
    ),
  }))
}

export function hydratePersistedTranscript(
  messages: PersistedTranscriptMessage[],
): void {
  const blocks: ChatBlock[] = messages.map((message, index) => {
    const ts = new Date(message.createdAt).getTime() || Date.now()
    if (message.role === 'user') {
      return { kind: 'user', id: index, text: message.content, ts }
    }
    if (message.role === 'error') {
      return { kind: 'error', id: index, message: message.content }
    }
    return { kind: 'text', id: index, text: message.content, ts }
  })
  transcriptStore.setState((state) => ({
    ...state,
    blocks,
    running: false,
    turnClosed: true,
    fsmPhase: null,
    currentActivity: null,
  }))
}

/** Append a client-originated notice line (command feedback etc.). */
export function pushLocalNotice(message: string): void {
  transcriptStore.setState((state) => noticeLine(state, message))
}

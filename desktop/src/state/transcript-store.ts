// FID-2026-0820-010 Loop 3 — transcript state. A pure event→block reducer
// (deterministic and independently testable) plus a thin zustand vanilla
// store wrapper. The gateway batches events on a fixed ~50ms flush interval
// server-side, so one reducer pass per WS frame already satisfies the
// <16ms/frame render budget without extra client-side coalescing.

import { createStore } from 'zustand/vanilla'

import { applyRosterEvent, initialRoster } from './roster'

import type { RosterEntry } from './roster'
import type { ToolResultOutput } from '@savant-code/common/types/messages/content-part'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

export type { RosterEntry } from './roster'

export type FidQueueStatus =
  'created' | 'analyzed' | 'fixed' | 'verified' | 'converged' | 'closed'

export type AutoDriveHaltState = 'idle' | 'requested' | 'confirmed' | 'failed'

export interface FidQueueEntry {
  fidId: string
  projectId: string
  status: FidQueueStatus
  parentId?: string
}

export type CompactionStatus = Extract<
  PrintModeEvent,
  { type: 'compaction_status' }
>

export type PersistedTranscriptMessage = {
  id: string
  role: string
  content: string
  createdAt: string
}

export type WorkspaceThread = {
  sessionId: string
  chatId: string
  agentId: string
  unread: boolean
  pinned: boolean
  messages: PersistedTranscriptMessage[]
}

export type ChatBlock =
  | { kind: 'text'; id: number; agentId?: string; text: string }
  | { kind: 'user'; id: number; text: string }
  | { kind: 'reasoning'; id: number; agentId: string; text: string }
  | {
      kind: 'tool'
      id: number
      toolCallId: string
      toolName: string
      inputJson: string | null
      outputText: string | null
      done: boolean
    }
  | { kind: 'error'; id: number; message: string }
  | {
      kind: 'ehel'
      id: number
      law: string
      severity: string
      message: string
    }
  | { kind: 'notice'; id: number; message: string }
  | {
      kind: 'approval'
      id: number
      approvalId: string
      requestType: string
      summary: string
    }

export type TranscriptState = {
  blocks: ChatBlock[]
  workspaceThreads: WorkspaceThread[]
  fidQueue: FidQueueEntry[]
  compactionStatus: CompactionStatus | null
  roster: RosterEntry[]
  /** True while an agent run is streaming (start seen, finish pending). */
  running: boolean
  /** After finish, the next text delta always opens a fresh block. */
  turnClosed: boolean
  /** Current Perfection Loop phase — derived ONLY from transition_phase
   * tool_result payloads (the G2 interim rule; never scraped or guessed). */
  fsmPhase: string | null
}

export const initialTranscriptState: TranscriptState = {
  blocks: [],
  workspaceThreads: [],
  fidQueue: [],
  compactionStatus: null,
  roster: initialRoster(),
  running: false,
  turnClosed: false,
  fsmPhase: null,
}

function safeJson(value: unknown): string {
  try {
    const serialized = JSON.stringify(value, null, 2)
    return serialized === undefined ? String(value) : serialized
  } catch {
    // Circular or otherwise unserializable payload — degrade, never throw.
    return String(value)
  }
}

function summarizeApproval(content: unknown): string {
  const flat = safeJson(content).replace(/\s+/g, ' ').trim()
  return flat.length > 240 ? `${flat.slice(0, 240)}…` : flat
}

/** Pull `{phase}` out of a transition_phase result's json parts (G2 rule). */
function extractFsmPhase(output: ToolResultOutput[]): string | null {
  for (const part of output) {
    if (part.type !== 'json') continue
    const value: unknown = part.value
    if (typeof value === 'object' && value !== null && 'phase' in value) {
      const phase = (value as { phase?: unknown }).phase
      if (typeof phase === 'string' && phase.length > 0) return phase
    }
  }
  return null
}

export function formatToolOutput(output: ToolResultOutput[]): string {
  return output
    .map((part) =>
      part.type === 'json' ? safeJson(part.value) : `[media ${part.mediaType}]`,
    )
    .join('\n')
}

function mergeOrAppendText(
  state: TranscriptState,
  agentId: string | undefined,
  text: string,
): TranscriptState {
  const last = state.blocks[state.blocks.length - 1]
  if (
    !state.turnClosed &&
    last !== undefined &&
    last.kind === 'text' &&
    last.agentId === agentId
  ) {
    const merged: ChatBlock = { ...last, text: last.text + text }
    return { ...state, blocks: [...state.blocks.slice(0, -1), merged] }
  }
  const fresh: ChatBlock = {
    kind: 'text',
    id: state.blocks.length,
    text,
    ...(agentId !== undefined ? { agentId } : {}),
  }
  return { ...state, turnClosed: false, blocks: [...state.blocks, fresh] }
}

function mergeOrAppendReasoning(
  state: TranscriptState,
  agentId: string,
  text: string,
): TranscriptState {
  const last = state.blocks[state.blocks.length - 1]
  if (
    last !== undefined &&
    last.kind === 'reasoning' &&
    last.agentId === agentId
  ) {
    const merged: ChatBlock = { ...last, text: last.text + text }
    return { ...state, blocks: [...state.blocks.slice(0, -1), merged] }
  }
  const fresh: ChatBlock = {
    kind: 'reasoning',
    id: state.blocks.length,
    agentId,
    text,
  }
  return { ...state, blocks: [...state.blocks, fresh] }
}

function applyEvent(
  state: TranscriptState,
  event: PrintModeEvent,
): TranscriptState {
  switch (event.type) {
    case 'start':
      return {
        ...state,
        running: true,
        roster: applyRosterEvent(state.roster, event),
      }
    case 'finish':
      return { ...state, running: false, turnClosed: true }
    case 'text':
      return mergeOrAppendText(state, event.agentId, event.text)
    case 'reasoning_delta':
      return mergeOrAppendReasoning(state, event.agentId, event.text)
    case 'tool_call': {
      const duplicate = state.blocks.some(
        (block) =>
          block.kind === 'tool' && block.toolCallId === event.toolCallId,
      )
      if (duplicate) return state
      const fresh: ChatBlock = {
        kind: 'tool',
        id: state.blocks.length,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        inputJson: safeJson(event.input),
        outputText: null,
        done: false,
      }
      return { ...state, blocks: [...state.blocks, fresh] }
    }
    case 'tool_result': {
      const nextState = {
        ...state,
        blocks: state.blocks.map((block) =>
          block.kind === 'tool' && block.toolCallId === event.toolCallId
            ? {
                ...block,
                outputText: formatToolOutput(event.output),
                done: true,
              }
            : block,
        ),
      }
      // G2 interim pairing: only a transition_phase RESULT carries the FSM
      // phase; absent/unparseable leaves the previous phase untouched.
      if (event.toolName === 'transition_phase') {
        const phase = extractFsmPhase(event.output)
        if (phase !== null) return { ...nextState, fsmPhase: phase }
      }
      return nextState
    }
    case 'error':
      return {
        ...state,
        blocks: [
          ...state.blocks,
          { kind: 'error', id: state.blocks.length, message: event.message },
        ],
      }
    case 'approval_request':
      return {
        ...state,
        blocks: [
          ...state.blocks,
          {
            kind: 'approval',
            id: state.blocks.length,
            approvalId: event.approvalId,
            requestType: event.requestType,
            summary: summarizeApproval(event.content),
          },
        ],
      }
    case 'compliance_warning':
      // Step 7: EHEL interventions render as distinct cards, not notice
      // lines — the governance surface must be scannable at a glance.
      return {
        ...state,
        blocks: [
          ...state.blocks,
          {
            kind: 'ehel',
            id: state.blocks.length,
            law: event.law,
            severity: event.severity,
            message: event.message,
          },
        ],
      }
    case 'provenance_receipt':
      return noticeLine(
        state,
        `trust receipt #${event.seq} ${event.phase} → ${event.status}`,
      )
    case 'subagent_start':
      return {
        ...noticeLine(state, `▶ ${event.displayName} (${event.agentType})`),
        roster: applyRosterEvent(state.roster, event),
      }
    case 'subagent_finish':
      return {
        ...noticeLine(state, `■ ${event.displayName} finished`),
        roster: applyRosterEvent(state.roster, event),
      }
    case 'download':
      return noticeLine(
        state,
        `runtime download v${event.version}: ${event.status}`,
      )
    case 'fid_update': {
      const nextEntry: FidQueueEntry = {
        fidId: event.fidId,
        projectId: event.projectId,
        status: event.status,
        ...(event.parentId !== undefined ? { parentId: event.parentId } : {}),
      }
      const existing = state.fidQueue.findIndex(
        (entry) =>
          entry.fidId === event.fidId && entry.projectId === event.projectId,
      )
      const fidQueue =
        existing === -1
          ? [...state.fidQueue, nextEntry]
          : state.fidQueue.map((entry, index) =>
              index === existing ? nextEntry : entry,
            )
      return {
        ...noticeLine(
          state,
          `FID ${event.projectId}/${event.fidId} → ${event.status}`,
        ),
        fidQueue,
      }
    }
    case 'compaction_status':
      return { ...state, compactionStatus: event }
    case 'activity':
      // Runtime activity indicator — no chat-thread surface in Loop 3 scope.
      return state
    default:
      return state
  }
}

function noticeLine(state: TranscriptState, message: string): TranscriptState {
  return {
    ...state,
    blocks: [
      ...state.blocks,
      { kind: 'notice', id: state.blocks.length, message },
    ],
  }
}

/** Reduce one WS-frame batch of events into the transcript state. */
export function applyEventBatch(
  state: TranscriptState,
  events: PrintModeEvent[],
): TranscriptState {
  let current = state
  for (const event of events) {
    current = applyEvent(current, event)
  }
  return current
}

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
    blocks: [...state.blocks, { kind: 'user', id: state.blocks.length, text }],
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
    if (message.role === 'user') {
      return { kind: 'user', id: index, text: message.content }
    }
    if (message.role === 'error') {
      return { kind: 'error', id: index, message: message.content }
    }
    return { kind: 'text', id: index, text: message.content }
  })
  transcriptStore.setState((state) => ({
    ...state,
    blocks,
    running: false,
    turnClosed: true,
    fsmPhase: null,
  }))
}

/** Append a client-originated notice line (command feedback etc.). */
export function pushLocalNotice(message: string): void {
  transcriptStore.setState((state) => noticeLine(state, message))
}

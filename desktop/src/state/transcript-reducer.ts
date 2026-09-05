import { applyRosterEvent, initialRoster } from './roster'
import {
  extractFsmPhase,
  formatToolOutput,
  safeJson,
  summarizeApproval,
} from './transcript-format'

import type {
  ChatBlock,
  FidQueueEntry,
  TranscriptState,
} from './transcript-types'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

// FID-2026-0819-005 Loop 298: pure event-to-block reducer machinery, moved
// verbatim from transcript-store.ts. noticeLine is exported for the store
// file's local-notice helper; everything else is the same public surface.

export const initialTranscriptState: TranscriptState = {
  blocks: [],
  workspaceThreads: [],
  fidQueue: [],
  compactionStatus: null,
  roster: initialRoster(),
  running: false,
  turnClosed: false,
  fsmPhase: null,
  currentActivity: null,
  model: null,
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
    const merged: ChatBlock = {
      ...last,
      text: last.text + text,
      ts: Date.now(),
    }
    return { ...state, blocks: [...state.blocks.slice(0, -1), merged] }
  }
  const fresh: ChatBlock = {
    kind: 'text',
    id: state.blocks.length,
    text,
    ts: Date.now(),
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

export function applyEvent(
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
      return {
        ...state,
        running: false,
        turnClosed: true,
        // P2: the run is over — the CLI status bar clears its indicator on
        // finish too, so a stale 'tool' label never survives the turn.
        currentActivity: null,
      }
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
      // P17: FID queue updates are already surfaced in the FID panel — a
      // per-FID transcript notice turned a run into a wall of
      // "FID … → analyzed/closed" lines. Update the queue only.
      return { ...state, fidQueue }
    }
    case 'compaction_status':
      return { ...state, compactionStatus: event }
    case 'compaction_summary': {
      // FID-2026-0828-001 desktop parity: the post-compaction summary is a
      // real transcript block (the CLI renders CompactionSummaryBlock), not
      // a status chip — the operator reads WHAT the pruner removed.
      return {
        ...state,
        blocks: [
          ...state.blocks,
          {
            kind: 'compaction_summary',
            id: state.blocks.length,
            summary: event.summary,
            removedMessages: event.removedMessages,
            ...(event.tokensSaved !== undefined
              ? { tokensSaved: event.tokensSaved }
              : {}),
            ...(event.percentUsed !== undefined
              ? { percentUsed: event.percentUsed }
              : {}),
          },
        ],
      }
    }
    case 'activity': {
      // FID-2026-0901-006 P2: surface the runtime activity indicator — the
      // same stream the CLI's status bar consumes. Root-level events only
      // (no agentId); sub-agent activity stays on the deck.
      if (event.agentId !== undefined) return state
      // P17: capture the running model from the thinking activity event so the
      // header can show what's actually driving the turn (mirrors the CLI's
      // AgentStatus `activity.model` read).
      const model =
        event.activity.kind === 'thinking'
          ? (event.activity.model ?? state.model)
          : state.model
      return {
        ...state,
        currentActivity:
          event.activity.kind === 'idle' ? null : { ...event.activity },
        model,
      }
    }
    default:
      return state
  }
}

export function noticeLine(
  state: TranscriptState,
  message: string,
): TranscriptState {
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

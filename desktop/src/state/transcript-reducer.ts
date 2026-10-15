import { applyRosterEvent, initialRoster } from './roster'
import {
  extractFsmPhase,
  formatToolOutput,
  safeJson,
  summarizeApproval,
} from './transcript-format'
import {
  mergeOrAppendReasoning,
  mergeOrAppendText,
  reduceActivity,
  reduceCompactionStatus,
  reduceCompactionSummary,
  reduceFidUpdate,
} from './transcript-reducer-events'

import type { ChatBlock, TranscriptState } from './transcript-types'
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
      // W4-1: attribute the call to the subagent that made it. The roster row
      // activated by `subagent_start` carries the same agentId the runtime
      // stamps on the tool_call (see the tool executor's onResponseChunk), and
      // its label is what the card badges. Root calls carry no agent id and
      // render unbadged.
      const attributedAgentId = event.agentId ?? event.parentAgentId
      const rosterEntry =
        attributedAgentId === undefined
          ? undefined
          : state.roster.find(
              (entry) =>
                entry.agentId === attributedAgentId &&
                entry.presence === 'active' &&
                entry.roleId !== 'savant',
            )
      const fresh: ChatBlock = {
        kind: 'tool',
        id: state.blocks.length,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        inputJson: safeJson(event.input),
        outputText: null,
        done: false,
        ...(event.agentId !== undefined ? { agentId: event.agentId } : {}),
        ...(event.parentAgentId !== undefined
          ? { parentAgentId: event.parentAgentId }
          : {}),
        ...(rosterEntry !== undefined ? { agentLabel: rosterEntry.label } : {}),
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
    // W3-6: the queue/activity/compaction branches live in
    // ./transcript-reducer-events with the block-merge helpers.
    case 'fid_update':
      return reduceFidUpdate(state, event)
    case 'compaction_status':
      return reduceCompactionStatus(state, event)
    case 'compaction_summary':
      return reduceCompactionSummary(state, event)
    case 'activity':
      return reduceActivity(state, event)
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

import type {
  ChatBlock,
  FidQueueEntry,
  TranscriptState,
} from './transcript-types'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

// FID-2026-1013-012 W3-6: the text/reasoning block-merge helpers and the
// queue/activity/compaction event branches, split out of
// `./transcript-reducer` so that module keeps headroom under the 300-line
// quality ceiling for Wave 4's subagent-attribution fields on tool blocks.
// Pure event-to-state functions — no store, no side effects.

type FidUpdateEvent = Extract<PrintModeEvent, { type: 'fid_update' }>
type CompactionSummaryEvent = Extract<
  PrintModeEvent,
  { type: 'compaction_summary' }
>
type ActivityEvent = Extract<PrintModeEvent, { type: 'activity' }>
type CompactionStatusEvent = Extract<
  PrintModeEvent,
  { type: 'compaction_status' }
>

/** Append a text delta, merging it into the open text block when one exists. */
export function mergeOrAppendText(
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

/** Append a reasoning delta to the same agent's open reasoning block. */
export function mergeOrAppendReasoning(
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

/** Update (or insert) the FID panel's queue row for this update. */
export function reduceFidUpdate(
  state: TranscriptState,
  event: FidUpdateEvent,
): TranscriptState {
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

/** Store the latest compaction status chip. */
export function reduceCompactionStatus(
  state: TranscriptState,
  event: CompactionStatusEvent,
): TranscriptState {
  return { ...state, compactionStatus: event }
}

/** Append the post-compaction summary block readers scan for. */
export function reduceCompactionSummary(
  state: TranscriptState,
  event: CompactionSummaryEvent,
): TranscriptState {
  // FID-2026-0828-001 desktop parity: the post-compaction summary is a real
  // transcript block (the CLI renders CompactionSummaryBlock), not a status
  // chip — the operator reads WHAT the pruner removed.
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

/** Surface the runtime activity indicator (and the active model). */
export function reduceActivity(
  state: TranscriptState,
  event: ActivityEvent,
): TranscriptState {
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

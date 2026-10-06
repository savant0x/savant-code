import { match } from 'ts-pattern'

import { useChatStore } from '../state/chat-store'
import { ensureStreaming } from './sdk-event-handlers/guards'
import {
  handleCompactionSummary,
  handleComplianceWarning,
  handleFinish,
} from './sdk-event-handlers/misc'
import {
  flushRootStream,
  markRootStreamDelta,
} from './sdk-event-handlers/root-stream-publisher'
import { handleToolResult } from './sdk-event-handlers/spawn-results'
import {
  handleSubagentFinish,
  handleSubagentStart,
  handleToolCall,
} from './sdk-event-handlers/subagents'
import {
  destinationFromChunkEvent,
  processTextChunk,
} from './stream-chunk-processor'

import type { RootStreamTiming } from './sdk-event-handlers/root-stream-publisher'
import type {
  EventHandlerState,
  StreamChunkEvent,
} from './sdk-event-handlers/types'
import type { PrintModeEvent as SDKEvent } from '@savant-code/common/types/print-mode'
import type { AgentActivity } from '@savant-code/common/types/session-state'

export type {
  SetStreamingAgentsFn,
  SetStreamStatusFn,
  StreamChunkEvent,
  StreamingState,
  MessageState,
  SubagentState,
  ModeState,
  EventHandlerState,
} from './sdk-event-handlers/types'

export const createStreamChunkHandler =
  (state: EventHandlerState, timing: RootStreamTiming = {}) =>
  (event: StreamChunkEvent) => {
    const destination = destinationFromChunkEvent(event)
    let text: string | undefined
    if (typeof event === 'string') {
      text = event
    } else {
      text = event.chunk
    }
    if (!destination) {
      state.logger.warn({ event }, 'Unhandled stream chunk event')
      return
    }
    if (!text) {
      return
    }
    ensureStreaming(state)
    if (destination.type === 'root') {
      if (destination.textType === 'text') {
        state.streaming.streamRefs.setters.appendRootStreamBuffer(text)
      }
      state.streaming.streamRefs.setters.setRootStreamSeen(true)
      // FID-2026-1006-002 WP10: the delta is recorded now and published on the
      // adaptive schedule. The tracker refs above stay immediate — they are
      // consumed by the run's own bookkeeping (plan extraction reads the
      // buffer), not by the render path the publisher throttles.
      markRootStreamDelta(state, { type: destination.textType, text }, timing)
      return
    }
    state.message.updater.updateAiMessageBlocks((blocks) =>
      processTextChunk(blocks, destination, text),
    )
  }
export const createEventHandler =
  (state: EventHandlerState) => (event: SDKEvent) => {
    // FID-2026-1006-002 WP10: an event is an ordering boundary. Events append
    // to the same transcript the chunk stream is filling (compliance notices,
    // compaction summaries, the finish marker), so text the stream still owes
    // is published BEFORE the event is dispatched — otherwise a throttled
    // delta would land after the notice that followed it.
    flushRootStream(state)
    return (
      match(event)
        .with({ type: 'subagent_start' }, (e) => handleSubagentStart(state, e))
        .with({ type: 'subagent_finish' }, (e) =>
          handleSubagentFinish(state, e),
        )
        .with({ type: 'tool_call' }, (e) => handleToolCall(state, e))
        .with({ type: 'tool_result' }, (e) => handleToolResult(state, e))
        .with({ type: 'finish' }, (e) => handleFinish(state, e))
        // FID-2026-0718-009: route runtime activity indicator to chat store.
        // The print-mode activity schema is permissive (all fields optional)
        // for forward-compat, but the runtime guarantees construction via
        // setActivity(), which produces a strict AgentActivity discriminated
        // union — so we cast at the boundary.
        .with({ type: 'activity' }, (e) =>
          useChatStore.getState().setActivity(e.activity as AgentActivity),
        )
        // FID-2026-0804-009: muted transcript receipt for harness ECHO
        // compliance warnings (Law 1 / Law 3 / Verifier trigger / FID review).
        .with({ type: 'compliance_warning' }, (e) =>
          handleComplianceWarning(state, e),
        )
        // FID-2026-0813-009: provenance events are stored for a read-only
        // trust-matrix subscription; they never dispatch tools or mutate the
        // runtime. The store owns the bounded display history.
        .with({ type: 'provenance_receipt' }, (e) =>
          useChatStore.getState().addProvenanceEvent(e),
        )
        // FID-2026-0828-001: the post-compaction summary becomes a
        // transcript block (TrafficLightPanel chrome) — the turn's visible
        // output for manual /compact and a mid-turn block for auto-compact.
        .with({ type: 'compaction_summary' }, (e) =>
          handleCompactionSummary(state, e),
        )
        .otherwise(() => undefined)
    )
  }

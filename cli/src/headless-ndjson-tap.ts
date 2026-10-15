// FID-2026-0907-004 — the handleEvent tap (BO Phase 1, FID 2).
//
// Maps the headless event stream (`PrintModeEvent`) onto the FID-003
// emitter's ratified five progress kinds. Tap, don't fork (BO rule): the
// caller composes this handler INTO the existing handleEvent seam — the
// pre-existing behavior (error-event stderr logging) stays in
// headless-run.ts and is untouched.
//
// Mapping (BO §Frozen Wire Contract rule 2, ground-truthed against
// common/src/types/print-mode.ts):
//   tool_call          → tool_call_started
//   tool_result        → tool_call_completed + iteration_completed
//   activity(thinking) → thinking_started   (first only — repeated
//                                          activity events do not re-fire)
//   reasoning_delta    → accumulate        (implicit span start when a
//                                          delta arrives with no prior
//                                          activity event)
//   any other event    → flush an open thinking span (thinking_completed)
//                          BEFORE its own frame, then no frame of its own
//
// The child stream has no native iteration-end or thinking-end event, so
// both completions are synthesized here (FID-003's mapping-honesty
// decisions): iteration_completed fires after each tool_result pair with
// tokens_used 0 (no token counts exist on this stream), and the thinking
// span flushes on the first event that is neither a thinking activity nor
// a reasoning delta. Error events emit no progress frame — error frames
// are FID-2026-0907-005's scope.

import type { NdjsonEmitter } from './headless-ndjson'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

/** Fields the tap reads from activity events (narrowed per the union). */
type ActivityEvent = Extract<PrintModeEvent, { type: 'activity' }>

function isThinkingActivity(event: ActivityEvent): boolean {
  return event.activity.kind === 'thinking'
}

/**
 * Create the event tap. The returned handler is stateful (thinking-span
 * bookkeeping) — one tap per run.
 */
export function createHeadlessEventTap(
  emitter: NdjsonEmitter,
): (event: PrintModeEvent) => void {
  let thinkingSpanOpen = false

  const flushThinking = (): void => {
    if (thinkingSpanOpen) {
      thinkingSpanOpen = false
      emitter.thinkingCompleted()
    }
  }

  return (event: PrintModeEvent) => {
    if (event.type === 'tool_call') {
      flushThinking()
      emitter.toolCallStarted(event.toolCallId, event.toolName)
      return
    }
    if (event.type === 'tool_result') {
      flushThinking()
      emitter.toolCallCompleted(event.toolCallId, event.toolName)
      emitter.iterationCompleted()
      return
    }
    if (event.type === 'reasoning_delta') {
      // A delta with no prior activity event implicitly starts the span.
      if (!thinkingSpanOpen) {
        thinkingSpanOpen = true
        emitter.thinkingStarted()
      }
      emitter.addReasoningDelta(event.text)
      return
    }
    if (event.type === 'activity') {
      if (isThinkingActivity(event)) {
        // Repeated thinking-activity events while a span is open do not
        // re-fire thinking_started.
        if (!thinkingSpanOpen) {
          thinkingSpanOpen = true
          emitter.thinkingStarted()
        }
        return
      }
      flushThinking()
      return
    }
    // start / text / finish / subagent variants / download /
    // compliance_warning / provenance_receipt / approval_request /
    // fid_queue_update / compaction variants / error: no progress frame.
    // An open thinking span still flushes so the parent sees completed
    // reasoning before the next step's activity.
    flushThinking()
  }
}

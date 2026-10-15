import { appendTextToRootStream } from '../block-operations'
import {
  extractPlanFromBuffer,
  insertPlanBlock,
} from '../message-block-helpers'

import type { EventHandlerState, TextDelta } from './types'
import type { JSONValue } from '@savant-code/common/types/json'
import type { ToolName } from '@savant-code/sdk'

export function isJSONValueRecord(
  value: JSONValue,
): value is Record<string, JSONValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
const hiddenToolNames = new Set<ToolName | 'spawn_agent_inline'>([
  // spawn_agent_inline nests under the parent agent's branch.
  'spawn_agent_inline',
  // end_turn is a no-op tool that closes the agent's step; its box is noise.
  'end_turn',
  // spawn_agents (multi-agent) is collapsed into parent agent branch.
  'spawn_agents',
  // render_ui widgets render inline as content; the bordered tool-call box
  // adds nothing the widget itself doesn't already convey.
  'render_ui',
])
export const isHiddenToolName = (
  toolName: string,
): toolName is ToolName | 'spawn_agent_inline' =>
  hiddenToolNames.has(toolName as ToolName | 'spawn_agent_inline')
export const ensureStreaming = (state: EventHandlerState) => {
  if (!state.message.hasReceivedContentRef.current) {
    state.message.hasReceivedContentRef.current = true
    state.streaming.setStreamStatus('streaming')
    state.setIsRetrying(false)
  }
}
export const appendRootChunk = (state: EventHandlerState, delta: TextDelta) => {
  if (!delta.text) {
    return
  }
  state.message.updater.updateAiMessageBlocks((blocks) =>
    appendTextToRootStream(blocks, delta),
  )
  if (
    state.mode.agentMode === 'SCAFFOLD' &&
    delta.type === 'text' &&
    !state.streaming.streamRefs.state.planExtracted &&
    state.streaming.streamRefs.state.rootStreamBuffer.includes('</PLAN>')
  ) {
    const rawPlan = extractPlanFromBuffer(
      state.streaming.streamRefs.state.rootStreamBuffer,
    )
    if (rawPlan !== null) {
      state.streaming.streamRefs.setters.setPlanExtracted(true)
      state.mode.setHasReceivedPlanResponse(true)
      state.message.updater.updateAiMessageBlocks((blocks) =>
        insertPlanBlock(blocks, rawPlan),
      )
    }
  }
}
// FID-2026-0718-010 (Q13): updateStreamingAgents now respects runCompleted.
// Same logic as before, but checks the run-end flag first.
export const updateStreamingAgents = (
  state: EventHandlerState,
  op: {
    add?: string
    remove?: string
  },
) => {
  guardedSetStreamingAgents(state, op)
}
/**
 * FID-2026-0718-010 (Q13): guard all streaming state mutations against the
 * runCompleted flag. After runCompleted is set, late-arriving chunks
 * (race condition) short-circuit with a warn-log.
 */
export function guardedSetStreamingAgents(
  state: EventHandlerState,
  op: {
    add?: string
    remove?: string
  },
): void {
  if (state.streaming.streamRefs.state.runCompleted) {
    state.logger.warn(
      { op: JSON.stringify(op) },
      '[sdk-event-handlers] late streaming-agent event after run end',
    )
    return
  }
  state.streaming.setStreamingAgents((prev) => {
    const next = new Set(prev)
    if (op.remove) next.delete(op.remove)
    if (op.add) next.add(op.add)
    return next
  })
}

import { useChatStore } from '../../state/chat-store'
import {
  extractSpawnAgentResultContent,
  transformAskUserBlocks,
  updateToolBlockWithOutput,
} from '../message-block-helpers'
import { isJSONValueRecord, updateStreamingAgents } from './guards'
import { reconcileSpawnResult } from './spawn-result-reconciliation'

import type { EventHandlerState } from './types'
import type { AgentContentBlock, ContentBlock } from '../../types/chat'
import type { JSONValue } from '@savant-code/common/types/json'
import type { PrintModeToolResult } from '@savant-code/common/types/print-mode'

function applySpawnResult(
  block: AgentContentBlock,
  resultValue: JSONValue,
): ContentBlock | null {
  const children = block.blocks ?? []
  const { content, hasError } = extractSpawnAgentResultContent(resultValue)
  if (hasError && children.length === 0) return null
  const finalBlocks = reconcileSpawnResult(
    children,
    content,
    hasError ? 'error' : block.agentType,
  )
  if (!finalBlocks.length) return block
  return { ...block, blocks: finalBlocks, status: 'complete' }
}

/** Recursively match the spawn call's result index to its child branch. */
const updateSpawnAgentBlock = (
  block: ContentBlock,
  toolCallId: string,
  results: JSONValue[],
): ContentBlock | null => {
  if (block.type !== 'agent') {
    return block
  }
  const spawnIndex = block.spawnIndex
  const childBlocks = block.blocks
  const isSpawnResultTarget =
    block.spawnToolCallId === toolCallId &&
    spawnIndex !== undefined &&
    childBlocks
  if (isSpawnResultTarget) {
    const result = results[spawnIndex]
    const resultRecord = isJSONValueRecord(result) ? result : null
    const resultValue = resultRecord?.value
    if (resultValue !== undefined) {
      return applySpawnResult(block, resultValue)
    }
  }
  if (!childBlocks?.length) {
    return block
  }
  return {
    ...block,
    blocks: updateSpawnAgentBlocks(childBlocks, toolCallId, results),
  }
}
const updateSpawnAgentBlocks = (
  blocks: ContentBlock[],
  toolCallId: string,
  results: JSONValue[],
): ContentBlock[] => {
  return blocks
    .map((block) => updateSpawnAgentBlock(block, toolCallId, results))
    .filter((block): block is ContentBlock => block !== null)
}
export const handleSpawnAgentsResult = (
  state: EventHandlerState,
  toolCallId: string,
  results: JSONValue[],
) => {
  // Replace placeholder spawn agent blocks with their final text/status output.
  state.message.updater.updateAiMessageBlocks((blocks) =>
    updateSpawnAgentBlocks(blocks, toolCallId, results),
  )
  results.forEach((_, index: number) => {
    const agentId = `${toolCallId}-${index}`
    updateStreamingAgents(state, { remove: agentId })
  })
  // FID-2026-0718-010 (F1): flush the parent agent's streaming-state too.
  // The parent's toolCallId/agentId may have been added back into
  // streamingAgents by text chunks during the spawn window. Without this
  // explicit remove, isStreaming stays true on the parent branch and the
  // "working..." shimmer never clears.
  flushParentStreamingAgents(state, toolCallId)
}
/**
 * FID-2026-0718-010 (F1 + Q13): clear the parent toolCallId / agentId and
 * any late chunks from streamingAgents. Also short-circuits if the run is
 * already completed (Q13: late-chunk-after-run-end).
 */
function flushParentStreamingAgents(
  state: EventHandlerState,
  toolCallId: string,
): void {
  if (state.streaming.streamRefs.state.runCompleted) {
    return
  }
  // Remove the parent's toolCallId from the streaming set (the loop ID).
  state.streaming.setStreamingAgents((prev) => {
    const next = new Set(prev)
    next.delete(toolCallId)
    return next
  })
}
export const handleToolResult = (
  state: EventHandlerState,
  event: PrintModeToolResult,
) => {
  const firstOutput = event.output?.[0]
  const askUserResult: JSONValue | undefined =
    firstOutput && firstOutput.type === 'json' ? firstOutput.value : undefined
  state.message.updater.updateAiMessageBlocks((blocks) =>
    transformAskUserBlocks(blocks, {
      toolCallId: event.toolCallId,
      resultValue: askUserResult,
    }),
  )
  const firstOutputValue: JSONValue | undefined =
    firstOutput && firstOutput.type === 'json' ? firstOutput.value : undefined
  const isSpawnAgentsResult =
    Array.isArray(firstOutputValue) &&
    firstOutputValue.some(
      (v) =>
        isJSONValueRecord(v) &&
        (typeof v.agentName === 'string' || typeof v.agentType === 'string'),
    )
  if (isSpawnAgentsResult && Array.isArray(firstOutputValue)) {
    handleSpawnAgentsResult(state, event.toolCallId, firstOutputValue)
    return
  }
  state.message.updater.updateAiMessageBlocks((blocks) =>
    updateToolBlockWithOutput(blocks, {
      toolCallId: event.toolCallId,
      toolOutput: event.output,
    }),
  )
  // Reflect ECHO FSM phase transitions into the chat store so the sidebar's
  // PhaseIndicator updates in real time. The transition_phase tool returns
  // `{ phase: 'red' | 'green' | 'audit' | ... }`; malformed payloads no-op.
  if (
    event.toolName === 'transition_phase' &&
    firstOutputValue != null &&
    isJSONValueRecord(firstOutputValue) &&
    typeof firstOutputValue.phase === 'string'
  ) {
    useChatStore.getState().setFsmPhase(firstOutputValue.phase)
  }
  updateStreamingAgents(state, { remove: event.toolCallId })
}

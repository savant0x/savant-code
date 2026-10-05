import { useChatStore } from '../../state/chat-store'
import {
  extractSpawnAgentResultContent,
  transformAskUserBlocks,
  updateToolBlockWithOutput,
} from '../message-block-helpers'
import { isJSONValueRecord, updateStreamingAgents } from './guards'

import type { EventHandlerState } from './types'
import type { ContentBlock } from '../../types/chat'
import type { JSONValue } from '@savant-code/common/types/json'
import type { PrintModeToolResult } from '@savant-code/common/types/print-mode'

/**
 * Recursively finds and updates agent blocks that match a spawn_agents tool call.
 */
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
      const { content, hasError } = extractSpawnAgentResultContent(resultValue)
      if (hasError) {
        if (childBlocks.length === 0) {
          return null
        }
        return {
          ...block,
          blocks: content
            ? [...childBlocks, { type: 'text', content } as ContentBlock]
            : childBlocks,
          status: 'complete' as const,
        }
      }
      // Agents like thinker return all output at the end via lastMessage,
      // while agents like basher may have already streamed their text.
      // FID-2026-1005-001: the streamed text is a live preview, NOT proof of
      // complete display — reconcile the authoritative final text against it
      // instead of dropping it whenever any streamed block exists.
      const streamedTextBlocks = childBlocks.filter(
        (b): b is Extract<ContentBlock, { type: 'text' }> =>
          b.type === 'text' && b.textType === 'text',
      )
      const hasStreamedTextContent = streamedTextBlocks.length > 0
      const streamedText = streamedTextBlocks
        .map((b) => b.content)
        .join('')
      let finalBlocks: ContentBlock[] = childBlocks
      if (content) {
        if (!hasStreamedTextContent) {
          // Nothing streamed: append the authoritative final text.
          finalBlocks = [...childBlocks, { type: 'text', content }]
        } else if (content === streamedText) {
          // Byte-equal: keep the streamed block (no duplicate).
          finalBlocks = childBlocks
        } else if (
          streamedText.length < content.length &&
          content.startsWith(streamedText)
        ) {
          // True prefix: the stream was cut before the end — append only
          // the missing suffix so the display equals the final result.
          finalBlocks = [
            ...childBlocks,
            { type: 'text', content: content.slice(streamedText.length) },
          ]
        } else {
          // Divergent text: the final result is authoritative — show it
          // alongside the preview rather than dropping either.
          finalBlocks = [...childBlocks, { type: 'text', content }]
        }
      }
      if (finalBlocks.length > 0) {
        return {
          ...block,
          blocks: finalBlocks,
          status: 'complete' as const,
        }
      }
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

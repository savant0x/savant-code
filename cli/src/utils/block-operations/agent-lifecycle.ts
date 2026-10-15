import { updateBlocksRecursively } from '../message-block-helpers'
import {
  closeNativeReasoningBlock,
  finalizeThinkingBlocks,
} from './think-parsing'

import type { ContentBlock, ToolContentBlock } from '../../types/chat'

/**
 * Closes native reasoning blocks within a specific agent's blocks.
 * Used when a tool call happens for a subagent.
 */
export const closeNativeReasoningInAgent = (
  blocks: ContentBlock[],
  agentId: string,
): ContentBlock[] => {
  return updateBlocksRecursively(blocks, agentId, (block) => {
    if (block.type !== 'agent') {
      return block
    }
    const closedBlocks = block.blocks
      ? closeNativeReasoningBlock(block.blocks)
      : undefined
    if (closedBlocks && closedBlocks !== block.blocks) {
      return { ...block, blocks: closedBlocks }
    }
    return block
  })
}

export const appendToolToAgentBlock = (
  blocks: ContentBlock[],
  agentId: string,
  toolBlock: ToolContentBlock,
) =>
  updateBlocksRecursively(blocks, agentId, (block) => {
    if (block.type !== 'agent') {
      return block
    }
    // Close any open native reasoning blocks before adding the tool
    const agentBlocks = block.blocks
      ? closeNativeReasoningBlock([...block.blocks])
      : []
    return { ...block, blocks: [...agentBlocks, toolBlock] }
  })

export const markAgentComplete = (blocks: ContentBlock[], agentId: string) =>
  updateBlocksRecursively(blocks, agentId, (block) => {
    if (block.type !== 'agent') {
      return block
    }
    // Finalize both native and tagged reasoning when the agent completes.
    const closedBlocks = block.blocks
      ? finalizeThinkingBlocks(block.blocks)
      : undefined
    return {
      ...block,
      status: 'complete' as const,
      ...(closedBlocks && { blocks: closedBlocks }),
    }
  })

/**
 * Recursively marks all agent blocks with status 'running' as 'cancelled'.
 * Used when the user interrupts a response to indicate subagents were stopped.
 * Also closes any open native reasoning blocks so they don't appear "streaming".
 */
export const markRunningAgentsAsCancelled = (
  blocks: ContentBlock[],
): ContentBlock[] => {
  return blocks.map((block) => {
    if (block.type !== 'agent') {
      return block
    }

    // First recursively process nested agents, then close any reasoning blocks
    let updatedBlocks = block.blocks
      ? markRunningAgentsAsCancelled(block.blocks)
      : undefined

    // Close any open native reasoning blocks in this agent
    if (updatedBlocks) {
      updatedBlocks = finalizeThinkingBlocks(updatedBlocks)
    }

    if (block.status === 'running') {
      return {
        ...block,
        status: 'cancelled' as const,
        ...(updatedBlocks && { blocks: updatedBlocks }),
      }
    }

    if (updatedBlocks && updatedBlocks !== block.blocks) {
      return { ...block, blocks: updatedBlocks }
    }

    return block
  })
}

import { updateBlocksRecursively } from '../message-block-helpers'
import {
  appendNativeReasoningToBlocks,
  appendTextWithThinkParsingToBlocks,
  closeNativeReasoningBlock,
} from './think-parsing'

import type { ContentBlock } from '../../types/chat'

type AgentTextUpdate =
  | {
      type: 'text'
      mode: 'append'
      content: string
      textType: 'text' | 'reasoning'
    }
  | { type: 'text'; mode: 'replace'; content: string }

const updateAgentText = (
  blocks: ContentBlock[],
  agentId: string,
  update: AgentTextUpdate,
) => {
  return updateBlocksRecursively(blocks, agentId, (block) => {
    if (block.type !== 'agent') {
      return block
    }

    const agentBlocks = block.blocks ? [...block.blocks] : []
    const text = update.content ?? ''

    if (update.mode === 'replace') {
      const updatedBlocks = [...agentBlocks]
      let replaced = false

      for (let i = updatedBlocks.length - 1; i >= 0; i--) {
        const entry = updatedBlocks[i]
        if (entry.type === 'text') {
          replaced = true
          if (entry.content === text && block.content === text) {
            return block
          }
          updatedBlocks[i] = { ...entry, content: text }
          break
        }
      }

      if (!replaced) {
        updatedBlocks.push({ type: 'text', content: text })
      }

      return {
        ...block,
        content: text,
        blocks: updatedBlocks,
      }
    }

    if (!text) {
      return block
    }

    // Handle native reasoning chunks for agent blocks
    if (update.textType === 'reasoning') {
      const updatedAgentBlocks = appendNativeReasoningToBlocks(
        agentBlocks,
        text,
      )
      const updatedContent = (block.content ?? '') + text
      return {
        ...block,
        content: updatedContent,
        blocks: updatedAgentBlocks,
      }
    }

    // For regular text: first close any open native reasoning block, then use think tag parsing
    const blocksWithClosedReasoning = closeNativeReasoningBlock(agentBlocks)
    const updatedAgentBlocks = appendTextWithThinkParsingToBlocks(
      blocksWithClosedReasoning,
      text,
    )
    const updatedContent = (block.content ?? '') + text
    return {
      ...block,
      content: updatedContent,
      blocks: updatedAgentBlocks,
    }
  })
}

export const appendTextToAgentBlock = (
  blocks: ContentBlock[],
  agentId: string,
  text: string,
  textType: 'text' | 'reasoning' = 'text',
) =>
  updateAgentText(blocks, agentId, {
    type: 'text',
    mode: 'append',
    content: text,
    textType,
  })

export const replaceTextInAgentBlock = (
  blocks: ContentBlock[],
  agentId: string,
  text: string,
) =>
  updateAgentText(blocks, agentId, {
    type: 'text',
    mode: 'replace',
    content: text,
  })

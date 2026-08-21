import { shouldCollapseByDefault, shouldCollapseForParent } from '../constants'

import type { ContentBlock, AgentContentBlock } from '../../types/chat'
import type { JSONValue } from '@savant-code/common/types/json'

export { appendInterruptionNotice } from './interruption-notice'

/**
 * Recursively finds an agent block by ID and returns its agent type.
 * Returns undefined if not found.
 */
export const findAgentTypeById = (
  blocks: ContentBlock[],
  agentId: string,
): string | undefined => {
  for (const block of blocks) {
    if (block.type === 'agent') {
      if (block.agentId === agentId) {
        return block.agentType
      }
      if (block.blocks) {
        const found = findAgentTypeById(block.blocks, agentId)
        if (found) {
          return found
        }
      }
    }
  }
  return undefined
}

/**
 * Options for creating an agent content block.
 */
export interface CreateAgentBlockOptions {
  agentId: string
  agentType: string
  prompt?: string
  params?: Record<string, JSONValue>
  /** The spawn_agents tool call ID that created this block */
  spawnToolCallId?: string
  /** The index within the spawn_agents call */
  spawnIndex?: number
  /** The agent type of the parent agent that spawned this one */
  parentAgentType?: string
}

/**
 * Creates a new agent content block with standard defaults.
 */
export const createAgentBlock = (
  options: CreateAgentBlockOptions,
): AgentContentBlock => {
  const {
    agentId,
    agentType,
    prompt,
    params,
    spawnToolCallId,
    spawnIndex,
    parentAgentType,
  } = options
  const shouldCollapse =
    shouldCollapseByDefault(agentType || '') ||
    shouldCollapseForParent(agentType || '', parentAgentType)
  return {
    type: 'agent',
    agentId,
    agentName: agentType || 'Agent',
    agentType: agentType || 'unknown',
    content: '',
    status: 'running' as const,
    blocks: [] as ContentBlock[],
    initialPrompt: prompt || '',
    ...(params && { params }),
    ...(spawnToolCallId && { spawnToolCallId }),
    ...(spawnIndex !== undefined && { spawnIndex }),
    ...(shouldCollapse && { isCollapsed: true }),
  }
}

/**
 * Helper function to recursively update blocks by target agent ID.
 */
export const updateBlocksRecursively = (
  blocks: ContentBlock[],
  targetAgentId: string,
  updateFn: (block: ContentBlock) => ContentBlock,
): ContentBlock[] => {
  let foundTarget = false
  const result = blocks.map((block) => {
    if (block.type === 'agent' && block.agentId === targetAgentId) {
      foundTarget = true
      return updateFn(block)
    }
    if (block.type === 'agent' && block.blocks) {
      const updatedBlocks = updateBlocksRecursively(
        block.blocks,
        targetAgentId,
        updateFn,
      )
      if (updatedBlocks !== block.blocks) {
        foundTarget = true
        return {
          ...block,
          blocks: updatedBlocks,
        }
      }
    }
    return block
  })

  return foundTarget ? result : blocks
}

/**
 * Result from nestBlockUnderParent indicating whether the parent was found.
 */
export interface NestBlockResult {
  blocks: ContentBlock[]
  parentFound: boolean
}

/**
 * Nests a block under a parent agent, or returns it at top level if parent not found.
 */
export const nestBlockUnderParent = (
  blocks: ContentBlock[],
  parentAgentId: string,
  blockToNest: ContentBlock,
): NestBlockResult => {
  let parentFound = false
  const updatedBlocks = updateBlocksRecursively(
    blocks,
    parentAgentId,
    (parentBlock) => {
      if (parentBlock.type !== 'agent') {
        return parentBlock
      }
      parentFound = true
      return {
        ...parentBlock,
        blocks: [...(parentBlock.blocks || []), blockToNest],
      }
    },
  )

  return { blocks: updatedBlocks, parentFound }
}

/**
 * Checks if a block with the given targetId exists anywhere in the children of the blocks.
 */
const findBlockInChildren = (
  blocks: ContentBlock[],
  targetId: string,
): boolean => {
  for (const block of blocks) {
    if (block.type === 'agent' && block.agentId === targetId) {
      return true
    }
    if (block.type === 'agent' && block.blocks) {
      if (findBlockInChildren(block.blocks, targetId)) {
        return true
      }
    }
  }
  return false
}

/**
 * Checks if a block with the given agentId is already nested under the specified parent.
 */
const checkBlockIsUnderParent = (
  blocks: ContentBlock[],
  targetAgentId: string,
  parentAgentId: string,
): boolean => {
  for (const block of blocks) {
    if (block.type === 'agent' && block.agentId === parentAgentId) {
      // Found the parent, check if target is anywhere in its children
      return findBlockInChildren(block.blocks || [], targetAgentId)
    } else if (block.type === 'agent' && block.blocks) {
      // Recurse into other agent blocks to find the parent
      if (checkBlockIsUnderParent(block.blocks, targetAgentId, parentAgentId)) {
        return true
      }
    }
  }
  return false
}

/**
 * Extracts a block with given agentId from nested blocks structure.
 * Returns the remaining blocks and the extracted block (if found).
 */
export const extractBlockById = (
  blocks: ContentBlock[],
  targetAgentId: string,
): { remainingBlocks: ContentBlock[]; extractedBlock: ContentBlock | null } => {
  let extractedBlock: ContentBlock | null = null

  const extractRecursively = (blocks: ContentBlock[]): ContentBlock[] => {
    const result: ContentBlock[] = []
    for (const block of blocks) {
      if (block.type === 'agent' && block.agentId === targetAgentId) {
        extractedBlock = block
        // Don't add to result - we're extracting it
      } else if (block.type === 'agent' && block.blocks) {
        result.push({
          ...block,
          blocks: extractRecursively(block.blocks),
        })
      } else {
        result.push(block)
      }
    }
    return result
  }

  const remainingBlocks = extractRecursively(blocks)
  return { remainingBlocks, extractedBlock }
}

export const moveSpawnAgentBlock = (
  blocks: ContentBlock[],
  tempId: string,
  realId: string,
  parentId?: string,
  params?: Record<string, JSONValue>,
  prompt?: string,
  realAgentType?: string,
): ContentBlock[] => {
  const updateAgentBlock = (block: ContentBlock): ContentBlock => {
    if (block.type !== 'agent') {
      return block
    }
    const updatedBlock: ContentBlock = {
      ...block,
      agentId: realId,
    }

    if (params) {
      updatedBlock.params = params
    }

    if (prompt && block.initialPrompt === '') {
      updatedBlock.initialPrompt = prompt
    }

    if (realAgentType) {
      updatedBlock.agentType = realAgentType
      updatedBlock.agentName = realAgentType
    }

    return updatedBlock
  }

  // If there's a parentId, we need to move the block under the parent.
  // First check if the block is already under the correct parent.
  if (parentId) {
    const isAlreadyUnderParent = checkBlockIsUnderParent(
      blocks,
      tempId,
      parentId,
    )
    if (isAlreadyUnderParent) {
      // Block is already under the correct parent, just update it in place
      return updateBlocksRecursively(blocks, tempId, updateAgentBlock)
    }

    // Block needs to be moved under the parent - extract and nest
    const { remainingBlocks, extractedBlock } = extractBlockById(blocks, tempId)
    if (extractedBlock && extractedBlock.type === 'agent') {
      const blockToMove = updateAgentBlock(extractedBlock)
      const { blocks: nestedBlocks, parentFound } = nestBlockUnderParent(
        remainingBlocks,
        parentId,
        blockToMove,
      )
      if (parentFound) {
        return nestedBlocks
      }
      // Parent not found, update in place instead of appending to end
      return updateBlocksRecursively(blocks, tempId, updateAgentBlock)
    }
  }

  // No parentId or block not found - just update in place to preserve order
  return updateBlocksRecursively(blocks, tempId, updateAgentBlock)
}

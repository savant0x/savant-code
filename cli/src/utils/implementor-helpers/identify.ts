import type {
  AgentContentBlock,
  ContentBlock,
  ToolContentBlock,
} from '../../types/chat'
import type { JSONValue } from '@savant-code/common/types/json'

export const IMPLEMENTOR_AGENT_IDS = [
  'editor-implementor',
  'editor-implementor-opus',
  'editor-implementor-gemini',
  'editor-implementor-gpt-5',
] as const

/** All edit tool names (both direct and proposed variants) */
export const ALL_EDIT_TOOL_NAMES = [
  'str_replace',
  'write_file',
  'propose_str_replace',
  'propose_write_file',
] as const

export const isProposedToolName = (
  toolName: ToolContentBlock['toolName'],
): boolean => typeof toolName === 'string' && toolName.startsWith('propose_')

export const getBaseToolName = (
  toolName: ToolContentBlock['toolName'],
): string =>
  isProposedToolName(toolName) ? toolName.slice('propose_'.length) : toolName

export const SUCCESSFUL_EDIT_MESSAGES = [
  'String replace applied successfully',
  'Created file successfully',
  'Created new file',
  'Overwrote file successfully',
  'Wrote file successfully',
  'Updated file',
  'Proposed new file',
  'Proposed changes',
  'Proposed string replacement',
] as const

export const isSuccessfulEditMessage = (message: JSONValue): boolean => {
  if (typeof message !== 'string') {
    return false
  }

  return message
    .split('\n')
    .some((line) =>
      SUCCESSFUL_EDIT_MESSAGES.some((successMessage) =>
        line.trim().startsWith(successMessage),
      ),
    )
}

const hasProposedTools = (blocks?: ContentBlock[]): boolean => {
  if (!blocks || blocks.length === 0) return false

  return blocks.some(
    (block) => block.type === 'tool' && isProposedToolName(block.toolName),
  )
}

/**
 * Check if an agent is an implementor agent.
 * These agents are rendered differently (as simple status lines instead of full agent blocks).
 */
export const isImplementorAgent = (
  agentBlock: Pick<AgentContentBlock, 'agentType' | 'blocks'>,
): boolean => {
  if (hasProposedTools(agentBlock.blocks)) {
    return true
  }

  return IMPLEMENTOR_AGENT_IDS.some((id) => agentBlock.agentType.includes(id))
}

/**
 * Get the display name for an implementor agent.
 */
export const getImplementorDisplayName = (
  agentType: string,
  index?: number,
): string => {
  let baseName = 'Implementor'
  if (agentType.includes('editor-implementor-opus')) {
    baseName = 'Opus'
  } else if (agentType.includes('editor-implementor-gemini')) {
    baseName = 'Gemini'
  } else if (agentType.includes('editor-implementor-gpt-5')) {
    baseName = 'GPT-5'
  } else if (agentType.includes('editor-implementor')) {
    baseName = 'Sonnet'
  }

  if (index !== undefined) {
    return `${baseName} #${index + 1}`
  }
  return baseName
}

/**
 * Get the index of an implementor agent among its siblings.
 * Returns the 0-based index among all implementor agents of the same type.
 */
export const getImplementorIndex = (
  currentAgent: AgentContentBlock,
  siblingBlocks: ContentBlock[],
): number | undefined => {
  if (!isImplementorAgent(currentAgent)) return undefined

  // Filter to only implementor agents of the same type
  const implementorSiblings = siblingBlocks.filter(
    (block): block is AgentContentBlock =>
      block.type === 'agent' &&
      isImplementorAgent(block) &&
      block.agentType === currentAgent.agentType,
  )

  // If there's only one, don't show an index
  if (implementorSiblings.length <= 1) {
    return undefined
  }

  // Find the index of the current agent
  return implementorSiblings.findIndex(
    (block) => block.agentId === currentAgent.agentId,
  )
}

/**
 * Group consecutive blocks from a blocks array that match the predicate.
 * Returns the group and the next index to process.
 */
export function groupConsecutiveBlocks<T extends ContentBlock>(
  blocks: ContentBlock[],
  startIndex: number,
  predicate: (block: ContentBlock) => block is T,
): { group: T[]; nextIndex: number } {
  const group: T[] = []
  let i = startIndex

  while (i < blocks.length) {
    const block = blocks[i]
    if (!predicate(block)) {
      break
    }
    group.push(block)
    i++
  }

  return { group, nextIndex: i }
}

/**
 * Group consecutive implementor agents from a blocks array.
 * Returns the group of implementors and the next index to process.
 */
export function groupConsecutiveImplementors(
  blocks: ContentBlock[],
  startIndex: number,
): { group: AgentContentBlock[]; nextIndex: number } {
  return groupConsecutiveBlocks(
    blocks,
    startIndex,
    (block): block is AgentContentBlock =>
      block.type === 'agent' && isImplementorAgent(block),
  )
}

export function groupConsecutiveNonImplementorAgents(
  blocks: ContentBlock[],
  startIndex: number,
): { group: AgentContentBlock[]; nextIndex: number } {
  return groupConsecutiveBlocks(
    blocks,
    startIndex,
    (block): block is AgentContentBlock =>
      block.type === 'agent' && !isImplementorAgent(block),
  )
}

export function groupConsecutiveToolBlocks(
  blocks: ContentBlock[],
  startIndex: number,
): { group: ToolContentBlock[]; nextIndex: number } {
  return groupConsecutiveBlocks(
    blocks,
    startIndex,
    (block): block is ToolContentBlock => block.type === 'tool',
  )
}

/**
 * Extract a value for a key from tool output (key: value format).
 * Supports multi-line values with pipe delimiter.
 */
export function extractValueForKey(output: string, key: string): string | null {
  if (!output) return null
  const lines = output.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(/^\s*([A-Za-z0-9_]+):\s*(.*)$/)
    if (match && match[1] === key) {
      const rest = match[2]
      if (rest.trim().startsWith('|')) {
        const baseIndent = lines[i + 1]?.match(/^\s*/)?.[0].length ?? 0
        const acc: string[] = []
        for (let j = i + 1; j < lines.length; j++) {
          const l = lines[j]
          const indent = l.match(/^\s*/)?.[0].length ?? 0
          if (l.trim().length === 0) {
            acc.push('')
            continue
          }
          if (indent < baseIndent) break
          acc.push(l.slice(baseIndent))
        }
        return acc.join('\n')
      } else {
        let val = rest.trim()
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1)
        }
        return val
      }
    }
  }
  return null
}

/**
 * Extract file path from tool block.
 */
export function extractFilePath(toolBlock: ToolContentBlock): string | null {
  const outputStr = typeof toolBlock.output === 'string' ? toolBlock.output : ''
  return (
    extractValueForKey(outputStr, 'file') ||
    (typeof toolBlock.input?.path === 'string' ? toolBlock.input.path : null) ||
    (typeof toolBlock.input?.file_path === 'string'
      ? toolBlock.input.file_path
      : null)
  )
}

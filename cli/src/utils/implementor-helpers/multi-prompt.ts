import { safeParseJSONObject } from '@savant-code/common/util/type-narrowing'

import { isImplementorAgent } from './identify'

import type { AgentContentBlock, ContentBlock } from '../../types/chat'
import type { JSONValue } from '@savant-code/common/types/json'

export interface MultiPromptProgress {
  /** Total number of implementor agents */
  total: number
  /** Number of successfully completed implementors */
  completed: number
  /** Number of failed/errored implementors */
  failed: number
  /** Whether selector is active (all implementors done, selecting best) */
  isSelecting: boolean
  /** Whether selector has completed (used to detect applying phase) */
  isSelectorComplete: boolean
}

/**
 * Analyze progress of a multi-prompt editor agent.
 * Returns counts of implementor agents and current phase.
 */
export function getMultiPromptProgress(
  blocks: ContentBlock[] | undefined,
): MultiPromptProgress | null {
  if (!blocks || blocks.length === 0) return null

  const implementors = blocks.filter(
    (block): block is AgentContentBlock =>
      block.type === 'agent' && isImplementorAgent(block),
  )

  if (implementors.length === 0) return null

  const completed = implementors.filter((a) => a.status === 'complete').length
  const failed = implementors.filter(
    (a) => a.status === 'failed' || a.status === 'cancelled',
  ).length

  const selectorAgent = blocks.find(
    (block): block is AgentContentBlock =>
      block.type === 'agent' && block.agentType.includes('best-of-n-selector'),
  )
  const isSelecting = selectorAgent?.status === 'running'

  return {
    total: implementors.length,
    completed,
    failed,
    isSelecting,
    isSelectorComplete: selectorAgent?.status === 'complete',
  }
}

/** Expected shape of the set_output data from editor-multi-prompt */
interface MultiPromptSetOutputData {
  implementationId?: string
  chosenStrategy?: string
  reason?: string
  suggestedImprovements?: string
  toolResults?: JSONValue[]
  error?: string
}

/** Expected shape of the set_output input (data is wrapped in a 'data' property) */
interface SetOutputInput {
  data?: MultiPromptSetOutputData
}

/** Type guard for set_output input with data property */
function hasSetOutputData(
  input: Record<string, JSONValue>,
): input is SetOutputInput & Record<string, JSONValue> {
  return safeParseJSONObject(input.data) !== undefined
}

/**
 * Extract the selection reason from multi-prompt agent's set_output block.
 * set_output wraps data in a 'data' property, so we need to access input.data.reason
 */
function extractSelectionReason(
  blocks: ContentBlock[] | undefined,
): string | null {
  if (!blocks || blocks.length === 0) return null

  for (const block of blocks) {
    if (
      block.type !== 'tool' ||
      block.toolName !== 'set_output' ||
      !hasSetOutputData(block.input)
    ) {
      continue
    }
    const reason = block.input.data?.reason
    if (typeof reason === 'string') {
      return reason
    }
  }

  return null
}

/**
 * Generate a progress-focused preview string for multi-prompt editor.
 * @param blocks - The nested content blocks of the agent
 * @param isAgentComplete - Whether the parent agent has finished (status === 'complete')
 */
export function getMultiPromptPreview(
  blocks: ContentBlock[] | undefined,
  isAgentComplete?: boolean,
): string | null {
  const progress = getMultiPromptProgress(blocks)
  if (!progress) return null

  const { total, completed, failed, isSelecting, isSelectorComplete } = progress
  const finished = completed + failed

  // Agent is fully complete - show final state with selection info
  // Use multi-line format: line 1 = count, lines 2-3 = reason (truncated to fit)
  if (isAgentComplete) {
    const reason = extractSelectionReason(blocks)
    if (reason) {
      // Capitalize first letter and truncate to 2 lines (line 1 is the count)
      const formattedReason = reason.charAt(0).toUpperCase() + reason.slice(1)
      const lines = formattedReason.split('\n')
      const truncatedReason =
        lines.length > 2
          ? lines.slice(0, 2).join('\n').trimEnd() + '...'
          : formattedReason
      return `${total} proposals evaluated\n${truncatedReason}`
    }
    return `${total} proposals evaluated`
  }

  // Selector completed but agent still running = applying phase
  if (isSelectorComplete) {
    return 'Applying selected changes...'
  }

  if (isSelecting) {
    return `${total} proposals complete • Selecting best...`
  }

  if (finished === total && total > 0) {
    if (failed > 0) {
      return `${completed}/${total} proposals complete (${failed} failed)`
    }
    return `${total} proposals complete`
  }

  if (finished > 0) {
    if (failed > 0) {
      return `${completed}/${total} complete, ${failed} failed...`
    }
    return `${completed}/${total} proposals complete...`
  }

  return `Generating ${total} proposals...`
}

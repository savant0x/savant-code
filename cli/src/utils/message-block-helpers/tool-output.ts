import { safeToJSONValue } from '@savant-code/common/util/type-narrowing'
import { isEqual } from 'lodash'

import { formatToolOutput } from '../savant-code-client'

import type { ContentBlock } from '../../types/chat'

/**
 * Options for updating tool blocks with output.
 */
export interface UpdateToolBlockOptions {
  toolCallId: string
  toolOutput: unknown[]
}

/**
 * Updates tool blocks with their output when tool results arrive.
 * Handles special formatting for terminal command output.
 * Recursively processes nested agent blocks.
 */
export const updateToolBlockWithOutput = (
  blocks: ContentBlock[],
  options: UpdateToolBlockOptions,
): ContentBlock[] => {
  const { toolCallId, toolOutput } = options

  return blocks.map((block) => {
    if (block.type === 'tool' && block.toolCallId === toolCallId) {
      let output: string
      if (block.toolName === 'run_terminal_command') {
        const first = toolOutput?.[0]
        let parsed: { stdout?: string; stderr?: string } | undefined
        if (first && typeof first === 'object' && 'value' in first) {
          const value = (first as { value: unknown }).value
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            parsed = value as { stdout?: string; stderr?: string }
          }
        }
        if (parsed?.stdout || parsed?.stderr) {
          output = (parsed.stdout || '') + (parsed.stderr || '')
        } else {
          output = formatToolOutput(toolOutput.map(safeToJSONValue))
        }
      } else {
        const parts = toolOutput.map(safeToJSONValue)
        output = formatToolOutput(parts)
        // FID-2026-0822-014: raw parts feed the display layer's shape
        // classifier (structured cards); `output` stays byte-identical for
        // the copy/export paths.
        return { ...block, output, outputRaw: parts }
      }
      return { ...block, output }
    } else if (block.type === 'agent' && block.blocks) {
      const updatedBlocks = updateToolBlockWithOutput(block.blocks, options)
      // Avoid creating new block if nested blocks didn't change
      if (isEqual(block.blocks, updatedBlocks)) {
        return block
      }
      return { ...block, blocks: updatedBlocks }
    }
    return block
  })
}

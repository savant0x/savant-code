import React, { memo, useCallback, type ReactNode } from 'react'

import { CopyableBlock } from './copyable-block'
import { ToolBranch } from './tool-branch'

import type { ContentBlock } from '../../types/chat'
import type { MarkdownPalette } from '../../utils/markdown-renderer'

interface ToolBlockGroupProps {
  toolBlocks: Extract<ContentBlock, { type: 'tool' }>[]
  keyPrefix: string
  startIndex: number
  /** @deprecated No longer used for margin calculation */
  nextIndex: number
  /** @deprecated No longer used for margin calculation */
  siblingBlocks: ContentBlock[]
  availableWidth: number
  onToggleCollapsed: (id: string) => void
  markdownPalette: MarkdownPalette
}

export const ToolBlockGroup = memo(
  ({
    toolBlocks,
    keyPrefix,
    startIndex,
    availableWidth,
    onToggleCollapsed,
    markdownPalette,
  }: ToolBlockGroupProps): ReactNode => {
    const groupNodes = toolBlocks
      .map((toolBlock) => (
        <ToolBranch
          key={`${keyPrefix}-tool-${toolBlock.toolCallId}`}
          toolBlock={toolBlock}
          keyPrefix={`${keyPrefix}-tool-${toolBlock.toolCallId}`}
          availableWidth={availableWidth}
          onToggleCollapsed={onToggleCollapsed}
          markdownPalette={markdownPalette}
        />
      ))
      .filter(Boolean)

    // Combine all tool texts for copying the group
    const getCopyText = useCallback(() => {
      return toolBlocks
        .filter((toolBlock) => toolBlock.toolName !== 'run_readonly_command')
        .map((toolBlock) => {
          if (toolBlock.type !== 'tool') return ''
          return `[Tool: ${toolBlock.toolName}]\nInput:\n${JSON.stringify(toolBlock.input, null, 2)}\n\nOutput:\n${toolBlock.output ?? '(no output)'}`
        })
        .filter(Boolean)
        .join('\n\n---\n\n')
    }, [toolBlocks])

    if (groupNodes.length === 0) return null

    return (
      <CopyableBlock getCopyText={getCopyText}>
        <box
          key={`${keyPrefix}-tool-group-${startIndex}`}
          style={{
            flexDirection: 'column',
            gap: 0,
          }}
        >
          {groupNodes}
        </box>
      </CopyableBlock>
    )
  },
)

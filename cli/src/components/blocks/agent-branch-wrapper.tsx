import { TextAttributes } from '@opentui/core'
import React, { memo, useCallback } from 'react'

import { AgentBody } from './agent-branch-body'
import { AgentBranchItem } from './agent-branch-item'
import { sanitizePreview } from './block-helpers'
import { CopyableBlock } from './copyable-block'
import { useTheme } from '../../hooks/use-theme'
import { useChatStore } from '../../state/chat-store'
import { isTextBlock } from '../../types/chat'
import {
  getAgentDisplayPrompt,
  getBasherFinishedOutputPreview,
} from '../../utils/agent-display'
import { getAgentStatusInfo } from '../../utils/agent-helpers'
import { getCodeSearcherCollapsedPreview } from '../../utils/code-search-summary'
import {
  shouldRenderAsSimpleText,
  isMultiPromptEditor,
} from '../../utils/constants'
import {
  isImplementorAgent,
  getImplementorIndex,
  getMultiPromptPreview,
} from '../../utils/implementor-helpers'

import type {
  AgentContentBlock,
  ContentBlock,
  ToolContentBlock,
} from '../../types/chat'
import type { MarkdownPalette } from '../../utils/markdown-renderer'
import type { JSONValue } from '@savant-code/common/types/json'

/**
 * Compute preview text for collapsed agent display.
 * Returns empty string when preview shouldn't be shown (expanded state).
 */
function getCollapsedPreview(
  agentBlock: AgentContentBlock,
  isStreaming: boolean,
  isCollapsed: boolean,
  availableWidth: number,
): string {
  // No preview needed if expanded and not streaming
  if (!isStreaming && !isCollapsed) {
    return ''
  }

  if (!isStreaming) {
    const outputPreview = getBasherFinishedOutputPreview(
      agentBlock,
      Math.max(24, Math.min(120, availableWidth - 4)),
    )
    if (outputPreview) {
      return outputPreview
    }
  }

  // For multi-prompt editors, try progress-focused preview first
  if (isMultiPromptEditor(agentBlock.agentType)) {
    const multiPromptPreview = getMultiPromptPreview(
      agentBlock.blocks,
      agentBlock.status === 'complete',
    )
    if (multiPromptPreview) {
      return multiPromptPreview
    }
  }

  const codeSearcherPreview = getCodeSearcherCollapsedPreview(agentBlock)
  if (codeSearcherPreview) {
    return codeSearcherPreview
  }

  // Default preview: use the displayed prompt or first line of text content.
  const displayPrompt = getAgentDisplayPrompt(agentBlock)
  if (displayPrompt) {
    return sanitizePreview(displayPrompt)
  }

  const textContent =
    agentBlock.blocks
      ?.filter(isTextBlock)
      .map((b) => b.content)
      .join('') || ''
  const firstLine = textContent.split('\n').find((line) => line.trim()) || ''
  return `${sanitizePreview(firstLine)}...`
}

export interface AgentBranchWrapperProps {
  agentBlock: Extract<ContentBlock, { type: 'agent' }>
  keyPrefix: string
  availableWidth: number
  markdownPalette: MarkdownPalette
  onToggleCollapsed: (id: string) => void
  onBuildFast: () => void
  onBuildMax: () => void
  onBuildLite: () => void
  siblingBlocks?: ContentBlock[]
  isLastMessage?: boolean
}

export const AgentBranchWrapper = memo(
  ({
    agentBlock,
    keyPrefix,
    availableWidth,
    markdownPalette,
    onToggleCollapsed,
    onBuildFast,
    onBuildMax,
    onBuildLite,
    siblingBlocks,
    isLastMessage,
  }: AgentBranchWrapperProps) => {
    const theme = useTheme()
    // Derive streaming boolean for this specific agent to avoid re-renders when other agents change
    const agentIsStreaming = useChatStore((state) =>
      state.streamingAgents.has(agentBlock.agentId),
    )

    const onToggle = useCallback(() => {
      onToggleCollapsed(agentBlock.agentId)
    }, [onToggleCollapsed, agentBlock.agentId])

    const getCopyText = useCallback(() => {
      // Serialize agent blocks with role prefix
      const lines: string[] = [`[Agent: ${agentBlock.agentName}]`]
      agentBlock.blocks?.forEach((b) => {
        if (b.type === 'text') {
          lines.push(b.content)
        } else if (b.type === 'tool') {
          lines.push(
            `[Tool: ${b.toolName}]\nInput: ${JSON.stringify(b.input)}\nOutput: ${b.output ?? '(no output)'}`,
          )
        }
      })
      return lines.join('\n\n')
    }, [agentBlock])

    if (shouldRenderAsSimpleText(agentBlock.agentType)) {
      const isStreaming = agentBlock.status === 'running' || agentIsStreaming

      const effectiveStatus = isStreaming ? 'running' : agentBlock.status
      const { indicator: statusIndicator, color: statusColor } =
        getAgentStatusInfo(effectiveStatus, theme)

      let statusText = 'Selecting best'
      let reason: string | undefined

      const isComplete = agentBlock.status === 'complete'
      if (isComplete && siblingBlocks) {
        const blocks = agentBlock.blocks ?? []
        // Find the set_output tool call block (not necessarily the last block)
        const setOutputBlock = blocks.find(
          (b): b is ToolContentBlock =>
            b.type === 'tool' && b.toolName === 'set_output',
        )
        // set_output wraps data in a 'data' property, so we need to access input.data
        const outputData = (
          setOutputBlock?.input as { data?: Record<string, JSONValue> }
        )?.data
        const implementationId = outputData?.implementationId as
          string | undefined
        if (implementationId) {
          const letterIndex = implementationId.charCodeAt(0) - 65
          const implementors = siblingBlocks.filter(
            (b): b is AgentContentBlock =>
              b.type === 'agent' && isImplementorAgent(b),
          )

          reason = outputData?.reason as string | undefined

          const selectedAgent = implementors[letterIndex]
          if (selectedAgent) {
            const index = getImplementorIndex(selectedAgent, siblingBlocks)
            statusText =
              index !== undefined
                ? `Selected Strategy #${index + 1}`
                : 'Selected'
          }
        }
      }

      return (
        <box
          key={keyPrefix}
          style={{
            flexDirection: 'column',
            gap: 0,
            width: '100%',
          }}
        >
          <box
            selectable={false}
            style={{ flexDirection: 'row', flexShrink: 0 }}
          >
            <text fg={statusColor} style={{ wrapMode: 'word' }}>
              {statusIndicator}
            </text>
            <text
              fg={theme.foreground}
              style={{ wrapMode: 'word' }}
              attributes={TextAttributes.BOLD}
            >
              {' '}
              {statusText}
            </text>
          </box>
          {reason && (
            <text
              style={{
                wrapMode: 'word',
                fg: theme.foreground,
                marginLeft: 2,
              }}
            >
              {reason}
            </text>
          )}
        </box>
      )
    }

    const isCollapsed = agentBlock.isCollapsed ?? false
    const isStreaming = agentBlock.status === 'running' || agentIsStreaming

    // Compute collapsed preview text
    const preview = getCollapsedPreview(
      agentBlock,
      isStreaming,
      isCollapsed,
      availableWidth,
    )
    const displayPrompt = getAgentDisplayPrompt(agentBlock)

    const effectiveStatus = isStreaming ? 'running' : agentBlock.status
    const {
      indicator: statusIndicator,
      label: statusLabel,
      color: statusColor,
    } = getAgentStatusInfo(effectiveStatus, theme)

    return (
      <CopyableBlock getCopyText={getCopyText} isStreaming={isStreaming}>
        <box key={keyPrefix} style={{ flexDirection: 'column', gap: 0 }}>
          <AgentBranchItem
            name={agentBlock.agentName}
            prompt={displayPrompt}
            agentId={agentBlock.agentId}
            isCollapsed={isCollapsed}
            isStreaming={isStreaming}
            preview={preview}
            statusLabel={statusLabel ?? undefined}
            statusColor={statusColor}
            statusIndicator={statusIndicator}
            onToggle={onToggle}
          >
            <AgentBody
              agentBlock={agentBlock}
              keyPrefix={keyPrefix}
              parentIsStreaming={isStreaming}
              availableWidth={availableWidth}
              markdownPalette={markdownPalette}
              onToggleCollapsed={onToggleCollapsed}
              onBuildFast={onBuildFast}
              onBuildMax={onBuildMax}
              onBuildLite={onBuildLite}
              isLastMessage={isLastMessage}
            />
          </AgentBranchItem>
        </box>
      </CopyableBlock>
    )
  },
)

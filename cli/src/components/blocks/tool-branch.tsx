import { memo, useCallback } from 'react'

import { renderContentWithMarkdown } from './content-with-markdown'
import { CopyableBlock } from './copyable-block'
import { renderMarkdownContent } from './markdown-content'
import { useTheme } from '../../hooks/use-theme'
import { useChatStore } from '../../state/chat-store'
import { shouldCollapseToolByDefault } from '../../utils/constants'
import { getToolDisplayInfo } from '../../utils/savant-code-client'
import { getToolComponent, renderToolComponent } from '../tools/registry'
import { ToolCallItem } from '../tools/tool-call-item'

import type { ContentBlock } from '../../types/chat'
import type { MarkdownPalette } from '../../utils/markdown-renderer'

interface ToolBranchProps {
  toolBlock: Extract<ContentBlock, { type: 'tool' }>
  keyPrefix: string
  availableWidth: number
  onToggleCollapsed: (id: string) => void
  markdownPalette: MarkdownPalette
}

export const ToolBranch = memo(
  ({
    toolBlock,
    keyPrefix,
    availableWidth,
    onToggleCollapsed,
    markdownPalette,
  }: ToolBranchProps) => {
    const theme = useTheme()
    // Derive streaming boolean for this specific tool to avoid re-renders when other tools/agents change
    const isStreaming = useChatStore((state) =>
      state.streamingAgents.has(toolBlock.toolCallId),
    )

    const sanitizePreview = (value: string): string =>
      value.replace(/[#*_`~\[\]()]/g, '').trim()

    const displayInfo = getToolDisplayInfo(toolBlock.toolName)

    // Tools without a registered component (fallback rendering) should be
    // collapsed by default. Resolved from registry membership (not render
    // success) so the same `isCollapsed` can feed both the custom-component
    // options below and the generic ToolCallItem fallback.
    const hasRegisteredComponent =
      getToolComponent(toolBlock.toolName) !== undefined
    const isCollapsed =
      toolBlock.isCollapsed ??
      (hasRegisteredComponent
        ? shouldCollapseToolByDefault(toolBlock.toolName)
        : true)

    const handleToggle = useCallback(() => {
      onToggleCollapsed(toolBlock.toolCallId)
    }, [onToggleCollapsed, toolBlock.toolCallId])

    // Check if there's a registered custom component for this tool
    const toolRenderConfig = renderToolComponent(toolBlock, theme, {
      availableWidth,
      indentationOffset: 0,
      previewPrefix: '',
      labelWidth: 0,
      // FID-2026-0823-006: hand the block's collapse state + toggle to
      // custom components so they can render their own expand/collapse
      // chrome (e.g. the compact write_file summary).
      isCollapsed,
      onToggle: handleToggle,
    })

    const inputContent = `\`\`\`json\n${JSON.stringify(toolBlock.input, null, 2)}\n\`\`\``
    const codeBlockLang =
      toolBlock.toolName === 'run_terminal_command' ? '' : 'yaml'
    const resultContent = toolBlock.output
      ? `\n\n**Result:**\n\`\`\`${codeBlockLang}\n${toolBlock.output}\n\`\`\``
      : ''
    const fullContent = inputContent + resultContent

    const lines = fullContent.split('\n').filter((line) => line.trim())
    const firstLine = lines[0] || ''
    const lastLine = lines[lines.length - 1] || firstLine
    const commandPreview =
      toolBlock.toolName === 'run_terminal_command' &&
      toolBlock.input &&
      typeof toolBlock.input === 'object' &&
      'command' in toolBlock.input &&
      typeof toolBlock.input.command === 'string'
        ? `$ ${toolBlock.input.command.trim()}`
        : null

    const streamingPreview = isStreaming
      ? (commandPreview ?? `${sanitizePreview(firstLine)}...`)
      : ''

    const getToolFinishedPreview = useCallback(
      (commandPrev: string | null, lastLn: string): string => {
        if (commandPrev) {
          return commandPrev
        }

        if (toolBlock.toolName === 'run_terminal_command' && toolBlock.output) {
          const outputLines = toolBlock.output
            .split('\n')
            .filter((line) => line.trim())
          const lastThreeLines = outputLines.slice(-3)
          const hasMoreLines = outputLines.length > 3
          const preview = lastThreeLines.join('\n')
          return hasMoreLines ? `...\n${preview}` : preview
        }

        return sanitizePreview(lastLn)
      },
      [toolBlock],
    )

    const finishedPreview = !isStreaming
      ? (toolRenderConfig?.collapsedPreview ??
        getToolFinishedPreview(commandPreview, lastLine))
      : ''

    const agentMarkdownOptions = {
      codeBlockWidth: Math.max(1, availableWidth),
      palette: {
        ...markdownPalette,
        codeTextFg: theme.foreground,
      },
    }

    const renderableDisplayContent = renderMarkdownContent({
      value: renderContentWithMarkdown({
        content: fullContent,
        isStreaming: false,
        codeBlockWidth: agentMarkdownOptions.codeBlockWidth,
        palette: agentMarkdownOptions.palette,
      }),
      theme,
      getAttributes: (extra = 0) => (theme.messageTextAttributes ?? 0) | extra,
      textColor: theme.foreground,
      keyPrefix: `${keyPrefix}-content`,
    })

    const headerName = displayInfo.name

    const getCopyText = useCallback(() => {
      return `[Tool: ${toolBlock.toolName}]\nInput:\n${JSON.stringify(toolBlock.input, null, 2)}\n\nOutput:\n${toolBlock.output ?? '(no output)'}`
    }, [toolBlock.toolName, toolBlock.input, toolBlock.output])

    if (toolBlock.toolName === 'end_turn') {
      return null
    }
    if (toolBlock.toolName === 'ask_user') {
      return null
    }
    if ('includeToolCall' in toolBlock && toolBlock.includeToolCall === false) {
      return null
    }

    // Skip the outer copy button for tools that own their copy affordance:
    // run_terminal_command/run_readonly_command render through the shared
    // TerminalCommandDisplay panel, which now ships its own copy footer
    // (FID-2026-0817-001); the transition_phase bar is informational
    // (FID-009).
    const shouldShowCopyButton =
      toolBlock.toolName !== 'run_terminal_command' &&
      toolBlock.toolName !== 'run_readonly_command' &&
      toolBlock.toolName !== 'transition_phase'

    if (shouldShowCopyButton) {
      return (
        <CopyableBlock
          getCopyText={getCopyText}
          isStreaming={isStreaming}
          footerLeft={toolRenderConfig?.footerLeft}
        >
          <box key={keyPrefix}>
            {toolRenderConfig ? (
              toolRenderConfig.content
            ) : (
              <ToolCallItem
                name={headerName}
                content={renderableDisplayContent}
                isCollapsed={isCollapsed}
                isStreaming={isStreaming}
                streamingPreview={streamingPreview}
                finishedPreview={finishedPreview}
                onToggle={handleToggle}
                titleSuffix={undefined}
              />
            )}
          </box>
        </CopyableBlock>
      )
    }

    // Render without the outer copy button for panel-owned / informational tools
    return (
      <box key={keyPrefix}>
        {toolRenderConfig ? (
          toolRenderConfig.content
        ) : (
          <ToolCallItem
            name={headerName}
            content={renderableDisplayContent}
            isCollapsed={isCollapsed}
            isStreaming={isStreaming}
            streamingPreview={streamingPreview}
            finishedPreview={finishedPreview}
            onToggle={handleToggle}
            titleSuffix={undefined}
          />
        )}
      </box>
    )
  },
)

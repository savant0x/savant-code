import React, {
  memo,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'

import { AgentBlockGrid } from './agent-block-grid'
import { AgentBranchWrapper } from './agent-branch-wrapper'
import { trimNewlines } from './block-helpers'
import { renderContentWithMarkdown } from './content-with-markdown'
import { ImplementorGroup } from './implementor-row'
import { renderMarkdownContent } from './markdown-content'
import { ThinkingBlock } from './thinking-block'
import { ToolBlockGroup } from './tool-block-group'
import { useTheme } from '../../hooks/use-theme'
import {
  processBlocks,
  type BlockProcessorHandlers,
} from '../../utils/block-processor'
import {
  AGENT_BRANCH_HORIZONTAL_INSET,
  getChildContentWidth,
} from '../../utils/chat-layout'
import { AGENT_CONTENT_HORIZONTAL_PADDING } from '../../utils/layout-helpers'

import type {
  AgentContentBlock,
  ContentBlock,
  HtmlContentBlock,
  TextContentBlock,
} from '../../types/chat'
import type { MarkdownPalette } from '../../utils/markdown-renderer'

interface AgentBodyProps {
  agentBlock: Extract<ContentBlock, { type: 'agent' }>
  keyPrefix: string
  parentIsStreaming: boolean
  availableWidth: number
  markdownPalette: MarkdownPalette
  onToggleCollapsed: (id: string) => void
  onBuildFast: () => void
  onBuildMax: () => void
  onBuildLite: () => void
  isLastMessage?: boolean
}

/** Props stored in ref for stable handler access in AgentBody */
interface AgentBodyPropsRef {
  agentBlock: AgentContentBlock
  keyPrefix: string
  nestedBlocks: ContentBlock[]
  parentIsStreaming: boolean
  availableWidth: number
  markdownPalette: MarkdownPalette
  onToggleCollapsed: (id: string) => void
  onBuildFast: () => void
  onBuildMax: () => void
  onBuildLite: () => void
  isLastMessage?: boolean
  theme: ReturnType<typeof useTheme>
  getAgentMarkdownOptions: (indent: number) => {
    codeBlockWidth: number
    palette: MarkdownPalette
  }
}

export const AgentBody = memo(
  ({
    agentBlock,
    keyPrefix,
    parentIsStreaming,
    availableWidth,
    markdownPalette,
    onToggleCollapsed,
    onBuildFast,
    onBuildMax,
    onBuildLite,
    isLastMessage,
  }: AgentBodyProps): ReactNode[] => {
    const theme = useTheme()
    const nestedBlocks = agentBlock.blocks ?? []

    const getAgentMarkdownOptions = useCallback(
      (indent: number) => {
        const indentationOffset = indent * 2
        return {
          codeBlockWidth: Math.max(
            1,
            getChildContentWidth(
              availableWidth,
              AGENT_BRANCH_HORIZONTAL_INSET +
                AGENT_CONTENT_HORIZONTAL_PADDING +
                indentationOffset,
            ),
          ),
          palette: {
            ...markdownPalette,
            codeTextFg: theme.foreground,
          },
        }
      },
      [availableWidth, markdownPalette, theme.foreground],
    )

    // Store props in ref for stable handler access (avoids 12+ useMemo dependencies)
    const propsRef = useRef<AgentBodyPropsRef>(null!)
    propsRef.current = {
      agentBlock,
      keyPrefix,
      nestedBlocks,
      parentIsStreaming,
      availableWidth,
      markdownPalette,
      onToggleCollapsed,
      onBuildFast,
      onBuildMax,
      onBuildLite,
      isLastMessage,
      theme,
      getAgentMarkdownOptions,
    }

    // Handlers are stable (empty deps) and read latest props from ref
    const handlers: BlockProcessorHandlers = useMemo(
      () => ({
        onReasoningGroup: (reasoningBlocks, startIndex) => {
          const p = propsRef.current
          return (
            <ThinkingBlock
              key={
                reasoningBlocks[0]?.thinkingId ??
                `${p.keyPrefix}-thinking-${startIndex}`
              }
              blocks={reasoningBlocks}
              onToggleCollapsed={p.onToggleCollapsed}
              availableWidth={p.availableWidth}
              isNested={true}
              isMessageComplete={p.agentBlock.status === 'complete'}
            />
          )
        },

        onToolGroup: (toolBlocks, startIndex, nextIndex) => {
          const p = propsRef.current
          return (
            <ToolBlockGroup
              key={`${p.keyPrefix}-tool-group-${startIndex}`}
              toolBlocks={toolBlocks}
              keyPrefix={p.keyPrefix}
              startIndex={startIndex}
              nextIndex={nextIndex}
              siblingBlocks={p.nestedBlocks}
              availableWidth={p.availableWidth}
              onToggleCollapsed={p.onToggleCollapsed}
              markdownPalette={p.markdownPalette}
            />
          )
        },

        onImplementorGroup: (implementors, startIndex) => {
          const p = propsRef.current
          return (
            <ImplementorGroup
              key={`${p.keyPrefix}-implementor-group-${startIndex}`}
              implementors={implementors}
              siblingBlocks={p.nestedBlocks}
              availableWidth={p.availableWidth}
            />
          )
        },

        onAgentGroup: (agentBlocks, startIndex) => {
          const p = propsRef.current
          return (
            <AgentBlockGrid
              key={`${p.keyPrefix}-agent-grid-${startIndex}`}
              agentBlocks={agentBlocks}
              keyPrefix={`${p.keyPrefix}-agent-grid-${startIndex}`}
              availableWidth={p.availableWidth}
              renderAgentBranch={(innerAgentBlock, prefix, width) => (
                <AgentBranchWrapper
                  agentBlock={innerAgentBlock}
                  keyPrefix={prefix}
                  availableWidth={width}
                  markdownPalette={p.markdownPalette}
                  onToggleCollapsed={p.onToggleCollapsed}
                  onBuildFast={p.onBuildFast}
                  onBuildMax={p.onBuildMax}
                  onBuildLite={p.onBuildLite}
                  siblingBlocks={p.nestedBlocks}
                  isLastMessage={p.isLastMessage}
                />
              )}
            />
          )
        },

        onSingleBlock: (block, index) => {
          const p = propsRef.current
          if (block.type === 'text') {
            const textBlock = block as TextContentBlock
            const nestedStatus = textBlock.status
            const isNestedStreamingText =
              p.parentIsStreaming || nestedStatus === 'running'
            const filteredNestedContent = isNestedStreamingText
              ? trimNewlines(textBlock.content)
              : textBlock.content.trim()
            if (!filteredNestedContent) {
              return null
            }
            const markdownOptionsForLevel = p.getAgentMarkdownOptions(0)
            const explicitColor = textBlock.color
            const nestedTextColor = explicitColor ?? p.theme.foreground

            return renderMarkdownContent({
              value: renderContentWithMarkdown({
                content: filteredNestedContent,
                isStreaming: isNestedStreamingText,
                codeBlockWidth: markdownOptionsForLevel.codeBlockWidth,
                palette: markdownOptionsForLevel.palette,
              }),
              theme: p.theme,
              getAttributes: () => undefined,
              textColor: nestedTextColor,
              keyPrefix: `${p.keyPrefix}-text-${index}`,
            })
          }

          if (block.type === 'html') {
            const htmlBlock = block as HtmlContentBlock

            return (
              <box
                key={`${p.keyPrefix}-html-${index}`}
                style={{
                  flexDirection: 'column',
                  gap: 0,
                }}
              >
                {htmlBlock.render({
                  textColor: p.theme.foreground,
                  theme: p.theme,
                })}
              </box>
            )
          }

          // Fallback for unknown block types
          return null
        },
      }),
      [], // Empty deps - handlers read from propsRef.current
    )

    return processBlocks(nestedBlocks, handlers) as ReactNode[]
  },
)

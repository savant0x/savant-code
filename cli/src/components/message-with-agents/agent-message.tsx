import { TextAttributes } from '@opentui/core'
import { memo, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { AgentChildrenGrid } from './children-grid'
import { useChatStore } from '../../state/chat-store'
import { useMessageBlockStore } from '../../state/message-block-store'
import {
  AGENT_MESSAGE_PREFIX_WIDTH,
  getChildContentWidth,
} from '../../utils/chat-layout'
import { AGENT_CONTENT_HORIZONTAL_PADDING } from '../../utils/layout-helpers'
import {
  hasMarkdown,
  type MarkdownPalette,
} from '../../utils/markdown-renderer'
import { renderExpandedContent } from '../blocks/block-helpers'
import { renderContentWithMarkdown } from '../blocks/content-with-markdown'
import { renderMarkdownContent } from '../blocks/markdown-content'
import { Button } from '../button'

import type { ChatMessage } from '../../types/chat'

interface AgentMessageProps {
  message: ChatMessage
  depth: number
  availableWidth: number
}

export const AgentMessage = memo(
  ({ message, depth, availableWidth }: AgentMessageProps): ReactNode => {
    // Use useShallow for grouped selectors to prevent unnecessary re-renders
    const { theme, markdownPalette, messageTree, onToggleCollapsed } =
      useMessageBlockStore(
        useShallow((state) => ({
          theme: state.context.theme,
          markdownPalette: state.context.markdownPalette,
          messageTree: state.context.messageTree,
          onToggleCollapsed: state.callbacks.onToggleCollapsed,
        })),
      )

    // Derive streaming boolean for this specific message to avoid re-renders when other agents change
    const isStreaming = useChatStore((state) =>
      state.streamingAgents.has(message.id),
    )
    const setFocusedAgentId = useChatStore((state) => state.setFocusedAgentId)

    // Guard against missing agent info (should not happen for agent variant messages)
    if (!message.agent) {
      return (
        <text fg={theme?.error}>
          Error: Missing agent info for agent message
        </text>
      )
    }
    const agentInfo = message.agent

    // Get or initialize collapse state from message metadata
    const isCollapsed = message.metadata?.isCollapsed ?? false

    const agentChildren = messageTree?.get(message.id) ?? []

    const bulletChar = '• '
    const fullPrefix = bulletChar

    const lines = message.content.split('\n').filter((line) => line.trim())
    const firstLine = lines[0] || ''
    const lastLine = lines[lines.length - 1] || firstLine
    const rawDisplayContent = isCollapsed ? lastLine : message.content

    const streamingPreview = isStreaming
      ? firstLine.replace(/[#*_`~\[\]()]/g, '').trim() + '...'
      : ''

    const finishedPreview =
      !isStreaming && isCollapsed
        ? lastLine.replace(/[#*_`~\[\]()]/g, '').trim()
        : ''

    const agentContentWidth = getChildContentWidth(
      availableWidth,
      AGENT_MESSAGE_PREFIX_WIDTH + AGENT_CONTENT_HORIZONTAL_PADDING,
    )
    const agentCodeBlockWidth = agentContentWidth
    const agentPalette: MarkdownPalette | undefined = markdownPalette
      ? {
          ...markdownPalette,
          codeTextFg: theme?.foreground ?? markdownPalette.codeTextFg,
        }
      : undefined
    const agentMarkdownOptions = {
      codeBlockWidth: agentCodeBlockWidth,
      palette: agentPalette!,
    }
    const displayContent = hasMarkdown(rawDisplayContent)
      ? renderContentWithMarkdown({
          content: rawDisplayContent,
          isStreaming,
          codeBlockWidth: agentMarkdownOptions.codeBlockWidth,
          palette: agentMarkdownOptions.palette,
        })
      : rawDisplayContent

    const handleTitleClick = (): void => {
      onToggleCollapsed(message.id)
      setFocusedAgentId(message.id)
    }

    const handleContentClick = (): void => {
      if (!isCollapsed) {
        return
      }

      onToggleCollapsed(message.id)
      setFocusedAgentId(message.id)
    }

    return (
      <box
        key={message.id}
        selectable={false}
        style={{
          flexDirection: 'column',
          gap: 0,
          flexShrink: 0,
        }}
      >
        <box
          selectable={false}
          style={{
            flexDirection: 'row',
            flexShrink: 0,
          }}
        >
          <text fg={theme?.success} style={{ wrapMode: 'none' }}>
            {fullPrefix}
          </text>
          <box
            selectable={false}
            style={{
              flexDirection: 'column',
              gap: 0,
              flexShrink: 1,
              flexGrow: 1,
            }}
          >
            <Button
              style={{
                flexDirection: 'row',
                alignSelf: 'flex-start',
                backgroundColor: isCollapsed ? theme?.muted : theme?.success,
                paddingLeft: 1,
                paddingRight: 1,
              }}
              onClick={handleTitleClick}
            >
              <box
                selectable={false}
                style={{ flexDirection: 'row', flexShrink: 0 }}
              >
                <text fg={theme?.foreground} style={{ wrapMode: 'none' }}>
                  {isCollapsed ? '▸ ' : '▾ '}
                </text>
                <text
                  fg={theme?.foreground}
                  style={{ wrapMode: 'none' }}
                  attributes={TextAttributes.BOLD}
                >
                  {agentInfo.agentName}
                </text>
              </box>
            </Button>
            <Button
              style={{ flexShrink: 1, paddingBottom: isCollapsed ? 1 : 0 }}
              onClick={handleContentClick}
            >
              {isStreaming && isCollapsed && streamingPreview.length > 0 ? (
                <text
                  style={{ wrapMode: 'word', fg: theme?.foreground }}
                  attributes={TextAttributes.ITALIC}
                >
                  {streamingPreview}
                </text>
              ) : null}
              {!isStreaming && isCollapsed && finishedPreview.length > 0 ? (
                <text
                  style={{ wrapMode: 'word', fg: theme?.muted }}
                  attributes={TextAttributes.ITALIC}
                >
                  {finishedPreview}
                </text>
              ) : null}
              {!isCollapsed &&
                (hasMarkdown(rawDisplayContent)
                  ? renderMarkdownContent({
                      value: displayContent,
                      theme: theme ?? { foreground: 'white' },
                      getAttributes: () => undefined,
                      textColor: theme?.foreground ?? 'white',
                      keyPrefix: `agent-content-${message.id}`,
                    })
                  : renderExpandedContent(
                      displayContent,
                      theme ?? { foreground: 'white' },
                      () => undefined,
                      theme?.foreground ?? 'white',
                      `agent-content-${message.id}`,
                    ))}
            </Button>
          </box>
        </box>
        {agentChildren.length > 0 && (
          <AgentChildrenGrid
            agentChildren={agentChildren}
            depth={depth}
            availableWidth={agentContentWidth}
          />
        )}
      </box>
    )
  },
)

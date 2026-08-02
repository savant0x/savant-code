import { TextAttributes } from '@opentui/core'
import { memo, useCallback, useMemo, type ReactNode } from 'react'
import React from 'react'
import { useShallow } from 'zustand/react/shallow'

import { renderExpandedContent } from './blocks/block-helpers'
import { renderContentWithMarkdown } from './blocks/content-with-markdown'
import { renderMarkdownContent } from './blocks/markdown-content'
import { Button } from './button'
import { ErrorBoundary } from './error-boundary'
import { GridLayout } from './grid-layout'
import { MessageBlock } from './message-block'
import { ModeDivider } from './mode-divider'
import { useChatStore } from '../state/chat-store'
import { useMessageBlockStore } from '../state/message-block-store'
import { splitByAgentSize } from '../utils/block-processor'
import {
  AGENT_MESSAGE_PREFIX_WIDTH,
  getChildContentWidth,
  getMessageContentWidth,
  MESSAGE_SIDE_GUTTER,
  ROOT_MESSAGE_PREFIX_WIDTH,
} from '../utils/chat-layout'
import { getCliEnv } from '../utils/env'
import {
  AGENT_CONTENT_HORIZONTAL_PADDING,
  MAX_AGENT_DEPTH,
} from '../utils/layout-helpers'
import { logger } from '../utils/logger'
import { hasMarkdown, type MarkdownPalette } from '../utils/markdown-renderer'

import type { ChatMessage } from '../types/chat'
import type { FeedbackCategory } from '@savant-code/common/constants/feedback'

interface AgentChildrenGridProps {
  agentChildren: ChatMessage[]
  depth: number
  availableWidth: number
}

const AgentChildrenGrid = memo(
  ({ agentChildren, depth, availableWidth }: AgentChildrenGridProps) => {
    const theme = useMessageBlockStore((state) => state.context.theme)

    const getItemKey = useCallback((agent: ChatMessage) => agent.id, [])

    const renderAgentChild = useCallback(
      (agent: ChatMessage, _idx: number, columnWidth: number) => (
        <MessageWithAgents
          message={agent}
          depth={depth + 1}
          isLastMessage={false}
          availableWidth={columnWidth}
        />
      ),
      [depth],
    )

    const subGroups = useMemo(
      () => splitByAgentSize(agentChildren, (m) => m.agent?.agentType ?? ''),
      [agentChildren],
    )

    if (agentChildren.length === 0) return null

    if (depth >= MAX_AGENT_DEPTH) {
      if (getCliEnv().NODE_ENV === 'development') {
        logger.warn(
          { depth, maxAgentDepth: MAX_AGENT_DEPTH },
          '[AgentChildrenGrid] Depth limit reached, truncating agent tree',
        )
      }
      return (
        <text fg={theme?.muted} attributes={TextAttributes.ITALIC}>
          {`${agentChildren.length} nested agent${
            agentChildren.length > 1 ? 's' : ''
          } not shown (depth limit)`}
        </text>
      )
    }

    const errorFallback = (
      <text fg={theme?.error}>Error rendering agent children</text>
    )

    return (
      <ErrorBoundary fallback={errorFallback} componentName="AgentChildrenGrid">
        <box
          selectable={false}
          style={{ flexDirection: 'column', gap: 0, width: '100%' }}
        >
          {subGroups.map((group) => (
            <GridLayout
              key={getItemKey(group[0])}
              items={group}
              availableWidth={availableWidth}
              getItemKey={getItemKey}
              renderItem={renderAgentChild}
            />
          ))}
        </box>
      </ErrorBoundary>
    )
  },
)

interface MessageWithAgentsProps {
  message: ChatMessage
  depth: number
  isLastMessage: boolean
  availableWidth: number
}

export const MessageWithAgents = memo(
  ({
    message,
    depth,
    isLastMessage,
    availableWidth,
  }: MessageWithAgentsProps): ReactNode => {
    const isAgent = message.variant === 'agent'

    // Use useShallow for grouped selectors to prevent unnecessary re-renders
    const {
      theme,
      markdownPalette,
      messageTree,
      isWaitingForResponse,
      timerStartTime,
    } = useMessageBlockStore(
      useShallow((state) => ({
        theme: state.context.theme,
        markdownPalette: state.context.markdownPalette,
        messageTree: state.context.messageTree,
        isWaitingForResponse: state.context.isWaitingForResponse,
        timerStartTime: state.context.timerStartTime,
      })),
    )

    const {
      onToggleCollapsed,
      onBuildFast,
      onBuildMax,
      onBuildLite,
      onFeedback,
      onCloseFeedback,
    } = useMessageBlockStore(
      useShallow((state) => ({
        onToggleCollapsed: state.callbacks.onToggleCollapsed,
        onBuildFast: state.callbacks.onBuildFast,
        onBuildMax: state.callbacks.onBuildMax,
        onBuildLite: state.callbacks.onBuildLite,
        onFeedback: state.callbacks.onFeedback,
        onCloseFeedback: state.callbacks.onCloseFeedback,
      })),
    )

    // Memoize onOpenFeedback to prevent unnecessary re-renders
    const onOpenFeedback = useCallback(
      (options?: {
        category?: FeedbackCategory
        footerMessage?: string
        errors?: Array<{ id: string; message: string }>
      }) => {
        onFeedback(message.id, options)
      },
      [onFeedback, message.id],
    )

    const contentBoxStyle = useMemo(
      () => ({
        backgroundColor: theme?.background,
        padding: 0,
        paddingLeft: MESSAGE_SIDE_GUTTER,
        paddingRight: MESSAGE_SIDE_GUTTER,
        paddingTop: 0,
        paddingBottom: 0,
        gap: 0,
        width: '100%' as const,
        flexGrow: 1,
        justifyContent: 'center' as const,
      }),
      [theme?.background],
    )

    if (isAgent) {
      return (
        <AgentMessage
          message={message}
          depth={depth}
          availableWidth={availableWidth}
        />
      )
    }

    const isAi = message.variant === 'ai'
    const isUser = message.variant === 'user'
    const isError = message.variant === 'error'

    if (
      message.blocks &&
      message.blocks.length === 1 &&
      message.blocks[0].type === 'mode-divider'
    ) {
      const dividerBlock = message.blocks[0]
      return (
        <ModeDivider
          key={message.id}
          mode={dividerBlock.mode}
          width={availableWidth}
        />
      )
    }

    const lineColor = isError
      ? 'red'
      : isAi
        ? (theme?.aiLine ?? 'white')
        : (theme?.userLine ?? 'white')
    const textColor = theme?.foreground ?? 'white'
    const timestampColor = isError
      ? 'red'
      : isAi
        ? (theme?.muted ?? 'white')
        : (theme?.muted ?? 'white')

    const hasRootPrefix = isAi || isUser
    const messageContentWidth =
      depth === 0
        ? getMessageContentWidth({
            availableWidth,
            prefixWidth: hasRootPrefix ? ROOT_MESSAGE_PREFIX_WIDTH : 0,
          })
        : getChildContentWidth(availableWidth, MESSAGE_SIDE_GUTTER * 2)
    const codeBlockWidth = messageContentWidth

    const paletteForMessage: MarkdownPalette | undefined = useMemo(
      () =>
        markdownPalette
          ? {
              ...markdownPalette,
              codeTextFg: textColor,
            }
          : undefined,
      [markdownPalette, textColor],
    )

    const markdownOptions = useMemo(
      () => ({ codeBlockWidth, palette: paletteForMessage! }),
      [codeBlockWidth, paletteForMessage],
    )

    const isLoading =
      isAi && message.content === '' && !message.blocks && isWaitingForResponse

    const agentChildren = messageTree?.get(message.id) ?? []
    const hasAgentChildren = agentChildren.length > 0
    // Prefix both user and assistant rows so ownership is visible without
    // changing the content-width contract between message variants.
    const showRootPrefix = isUser || isAi

    return (
      <box
        key={message.id}
        selectable={false}
        style={{
          width: '100%',
          flexDirection: 'column',
          gap: 0,
          paddingBottom: isLastMessage ? 0 : 1,
        }}
      >
        <box
          selectable={false}
          style={{
            width: '100%',
            flexDirection: 'row',
          }}
        >
          {showRootPrefix ? (
            <box
              selectable={false}
              style={{
                flexDirection: 'row',
                gap: 0,
                alignItems: 'stretch',
                width: '100%',
                flexGrow: 1,
              }}
            >
              {/* User message prefix: > in cyan */}
              {isUser && (
                <text
                  style={{ fg: lineColor, width: ROOT_MESSAGE_PREFIX_WIDTH }}
                >
                  {'> '}
                </text>
              )}
              {/* Assistant message prefix: ◆ in the assistant line color */}
              {isAi && (
                <text
                  style={{ fg: lineColor, width: ROOT_MESSAGE_PREFIX_WIDTH }}
                >
                  {'◆ '}
                </text>
              )}
              <box selectable={false} style={contentBoxStyle}>
                <MessageBlock
                  messageId={message.id}
                  blocks={message.blocks}
                  content={message.content}
                  isUser={isUser}
                  isAi={isAi}
                  isLoading={isLoading}
                  timestamp={message.timestamp}
                  isComplete={message.isComplete}
                  completionTime={message.completionTime}
                  credits={message.credits}
                  timerStartTime={timerStartTime}
                  textColor={textColor}
                  timestampColor={timestampColor}
                  markdownOptions={markdownOptions}
                  availableWidth={messageContentWidth}
                  markdownPalette={markdownPalette!}
                  onToggleCollapsed={onToggleCollapsed}
                  onBuildFast={onBuildFast}
                  onBuildMax={onBuildMax}
                  onBuildLite={onBuildLite}
                  onFeedback={onFeedback}
                  onCloseFeedback={onCloseFeedback}
                  validationErrors={message.validationErrors}
                  userError={message.userError}
                  onOpenFeedback={onOpenFeedback}
                  attachments={message.attachments}
                  textAttachments={message.textAttachments}
                  fileAttachments={message.fileAttachments}
                  metadata={message.metadata}
                  isLastMessage={isLastMessage}
                />
              </box>
            </box>
          ) : (
            <box selectable={false} style={contentBoxStyle}>
              <MessageBlock
                messageId={message.id}
                blocks={message.blocks}
                content={message.content}
                isUser={isUser}
                isAi={isAi}
                isLoading={isLoading}
                timestamp={message.timestamp}
                isComplete={message.isComplete}
                completionTime={message.completionTime}
                credits={message.credits}
                timerStartTime={timerStartTime}
                textColor={textColor}
                timestampColor={timestampColor}
                markdownOptions={markdownOptions}
                availableWidth={messageContentWidth}
                markdownPalette={markdownPalette!}
                onToggleCollapsed={onToggleCollapsed}
                onBuildFast={onBuildFast}
                onBuildMax={onBuildMax}
                onBuildLite={onBuildLite}
                onFeedback={onFeedback}
                onCloseFeedback={onCloseFeedback}
                validationErrors={message.validationErrors}
                userError={message.userError}
                onOpenFeedback={onOpenFeedback}
                attachments={message.attachments}
                textAttachments={message.textAttachments}
                fileAttachments={message.fileAttachments}
                metadata={message.metadata}
                isLastMessage={isLastMessage}
              />
            </box>
          )}
        </box>

        {hasAgentChildren && (
          <AgentChildrenGrid
            agentChildren={agentChildren}
            depth={depth}
            availableWidth={getChildContentWidth(
              messageContentWidth,
              AGENT_CONTENT_HORIZONTAL_PADDING,
            )}
          />
        )}
      </box>
    )
  },
)

interface AgentMessageProps {
  message: ChatMessage
  depth: number
  availableWidth: number
}

const AgentMessage = memo(
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

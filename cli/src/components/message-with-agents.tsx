import { memo, useCallback, useMemo, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { MessageBlock } from './message-block'
import { ModeDivider } from './mode-divider'
import { useMessageBlockStore } from '../state/message-block-store'
import {
  getChildContentWidth,
  getMessageContentWidth,
  MESSAGE_SIDE_GUTTER,
  ROOT_MESSAGE_PREFIX_WIDTH,
} from '../utils/chat-layout'
import { AGENT_CONTENT_HORIZONTAL_PADDING } from '../utils/layout-helpers'
import { AgentMessage } from './message-with-agents/agent-message'
import { AgentChildrenGrid } from './message-with-agents/children-grid'

import type { ChatMessage } from '../types/chat'
import type { MarkdownPalette } from '../utils/markdown-renderer'
import type { FeedbackCategory } from '@savant-code/common/constants/feedback'

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
    const isAi = message.variant === 'ai'
    const isUser = message.variant === 'user'
    const isError = message.variant === 'error'

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

    // Hoisted above the early returns so every hook runs unconditionally
    // (Rules of Hooks): a conditional `return` before a hook crashes React.
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

    if (isAgent) {
      return (
        <AgentMessage
          message={message}
          depth={depth}
          availableWidth={availableWidth}
        />
      )
    }

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

    const isLoading =
      isAi && message.content === '' && !message.blocks && isWaitingForResponse

    const agentChildren = messageTree?.get(message.id) ?? []
    const hasAgentChildren = agentChildren.length > 0
    // Prefix both user and assistant rows so ownership is visible without
    // changing the content-width contract between message variants.
    const showRootPrefix = isUser || isAi

    const messageBlock = (
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
    )

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
                {messageBlock}
              </box>
            </box>
          ) : (
            <box selectable={false} style={contentBoxStyle}>
              {messageBlock}
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

import { TextAttributes } from '@opentui/core'
import React, { memo } from 'react'

import { useTheme } from '../../hooks/use-theme'
import { CopyButton } from '../copy-button'
import { trimNewlines } from './block-helpers'
import { renderContentWithMarkdown } from './content-with-markdown'
import { renderMarkdownContent } from './markdown-content'

import type { MarkdownPalette } from '../../utils/markdown-renderer'

interface UserContentWithCopyButtonProps {
  content: string
  messageId: string
  isLoading: boolean
  isComplete?: boolean
  isUser: boolean
  textColor: string
  codeBlockWidth: number
  palette: MarkdownPalette
  showCopyButton: boolean
}

export const UserContentWithCopyButton = memo(
  ({
    content,
    messageId,
    isLoading,
    isComplete,
    isUser,
    textColor,
    codeBlockWidth,
    palette,
    showCopyButton,
  }: UserContentWithCopyButtonProps) => {
    const theme = useTheme()
    const isStreamingMessage = isLoading || !isComplete
    const normalizedContent = isStreamingMessage
      ? trimNewlines(content)
      : content.trim()

    const hasContent = normalizedContent.length > 0

    if (!hasContent) {
      return null
    }

    if (!showCopyButton) {
      return renderMarkdownContent({
        value: renderContentWithMarkdown({
          content: normalizedContent,
          isStreaming: isStreamingMessage,
          codeBlockWidth,
          palette,
        }),
        theme,
        getAttributes: (extra = 0) =>
          (isUser ? TextAttributes.ITALIC : 0) | extra,
        textColor,
        keyPrefix: `message-content-${messageId}`,
      })
    }

    return (
      <UserTextWithInlineCopy
        messageId={messageId}
        content={content}
        normalizedContent={normalizedContent}
        isStreamingMessage={isStreamingMessage}
        textColor={textColor}
        codeBlockWidth={codeBlockWidth}
        palette={palette}
      />
    )
  },
)

interface UserTextWithInlineCopyProps {
  messageId: string
  content: string
  normalizedContent: string
  isStreamingMessage: boolean
  textColor: string
  codeBlockWidth: number
  palette: MarkdownPalette
}

const UserTextWithInlineCopy = memo(
  ({
    messageId,
    content,
    normalizedContent,
    isStreamingMessage,
    textColor,
    codeBlockWidth,
    palette,
  }: UserTextWithInlineCopyProps) => {
    const theme = useTheme()
    return (
      <CopyButton
        as="box"
        textToCopy={content}
        style={{ wrapMode: 'word', fg: textColor }}
      >
        {renderMarkdownContent({
          value: renderContentWithMarkdown({
            content: normalizedContent,
            isStreaming: isStreamingMessage,
            codeBlockWidth,
            palette,
          }),
          theme,
          getAttributes: (extra = 0) => TextAttributes.ITALIC | extra,
          textColor,
          keyPrefix: `message-content-${messageId}`,
        })}
      </CopyButton>
    )
  },
)

interface UserBlockTextWithInlineCopyProps {
  content: string
  contentToCopy: string
  isStreaming: boolean
  textColor: string
  codeBlockWidth: number
  palette: MarkdownPalette
  marginTop: number
  marginBottom: number
}

export const UserBlockTextWithInlineCopy = memo(
  ({
    content,
    contentToCopy,
    isStreaming,
    textColor,
    codeBlockWidth,
    palette,
    marginTop,
    marginBottom,
  }: UserBlockTextWithInlineCopyProps) => {
    const theme = useTheme()
    return (
      <CopyButton
        as="box"
        textToCopy={contentToCopy}
        style={{
          wrapMode: 'word',
          fg: textColor,
          marginTop,
          marginBottom,
        }}
      >
        {renderMarkdownContent({
          value: renderContentWithMarkdown({
            content,
            isStreaming,
            codeBlockWidth,
            palette,
          }),
          theme,
          getAttributes: (extra = 0) => TextAttributes.ITALIC | extra,
          textColor,
          keyPrefix: 'user-block-content',
        })}
      </CopyButton>
    )
  },
)

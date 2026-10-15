import { memo, type ReactNode } from 'react'

import {
  renderMarkdown,
  renderStreamingMarkdown,
  hasMarkdown,
  type MarkdownPalette,
} from '../../utils/markdown-renderer'

interface ContentWithMarkdownProps {
  content: string
  isStreaming: boolean
  codeBlockWidth: number
  palette: MarkdownPalette
}

export function renderContentWithMarkdown({
  content,
  isStreaming,
  codeBlockWidth,
  palette,
}: ContentWithMarkdownProps): ReactNode {
  if (!hasMarkdown(content)) {
    return content
  }
  const options = { codeBlockWidth, palette }
  return isStreaming
    ? renderStreamingMarkdown(content, options)
    : renderMarkdown(content, options)
}

export const ContentWithMarkdown = memo((props: ContentWithMarkdownProps) =>
  renderContentWithMarkdown(props),
)

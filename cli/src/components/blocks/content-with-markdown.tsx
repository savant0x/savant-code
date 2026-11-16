import { memo, useMemo, useRef, type ReactNode } from 'react'

import {
  renderMarkdown,
  renderStreamingMarkdown,
  hasMarkdown,
  type MarkdownPalette,
} from '../../utils/markdown-renderer'
import { MarkdownStreamCache } from '../../utils/markdown-stream-cache'

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

interface StreamingMarkdownNodesProps {
  content: string
  isStreaming: boolean
  codeBlockWidth: number
  palette: MarkdownPalette
  children: (nodes: ReactNode) => ReactNode
}

/**
 * Renders streaming text through the incremental render cache
 * (FID-2026-1030-006). The cache lives in a ref for the lifetime of the block,
 * so a flush only renders the text that arrived since the frozen prefix. The
 * cached nodes are handed back to the caller, which keeps the semantic-block
 * adapter (`renderMarkdownContent`) at the same position in the tree.
 */
export function StreamingMarkdownNodes({
  content,
  isStreaming,
  codeBlockWidth,
  palette,
  children,
}: StreamingMarkdownNodesProps) {
  const cacheRef = useRef<MarkdownStreamCache | null>(null)
  cacheRef.current ??= new MarkdownStreamCache()
  const cache = cacheRef.current

  const nodes = useMemo(() => {
    if (!hasMarkdown(content)) return content
    const options = { codeBlockWidth, palette }
    return isStreaming
      ? cache.renderContent(content, options)
      : renderMarkdown(content, options)
  }, [cache, content, isStreaming, codeBlockWidth, palette])

  return <>{children(nodes)}</>
}

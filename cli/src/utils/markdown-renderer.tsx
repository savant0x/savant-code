import React from 'react'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

import { logger } from './logger'
import { applyInlineFallbackFormatting } from './markdown-inline'
import { defaultPalette, resolvePalette } from './markdown-palette'
import { renderNode } from './markdown-renderers'
import { trimTrailingWhitespaceNodes } from './markdown-text'
import { createRenderState } from './markdown-types'
import { createSyntaxStyle } from './syntax-theme'
import { createMarkdownPalette } from './theme-system'

import type { MarkdownNode } from './markdown-inline'
import type { MarkdownRenderOptions } from './markdown-types'
import type { Root } from 'mdast'
import type { ReactNode } from 'react'

// FID-2026-0805-003 (file-length deconstruction, Phase 1): the renderer was
// split into cohesive modules — markdown-inline (emphasis fallback parser),
// markdown-text (plain-text + wrapping helpers), markdown-palette (default
// palette + resolve), markdown-types (shared types), markdown-renderers
// (leaf renderers + renderNode dispatcher), markdown-tables (table renderers).
// This file is the public API and re-exports every consumed symbol so no
// consumer changes. Zero behavior change — pure module moves.

export type { MarkdownPalette, MarkdownRenderOptions } from './markdown-types'

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkBreaks)

const normalizeOutput = (nodes: ReactNode[]): ReactNode => {
  const normalized: ReactNode[] = []

  nodes.forEach((node) => {
    if (typeof node === 'string' && /^\s+$/.test(node)) {
      const previous = normalized[normalized.length - 1]
      if (typeof previous === 'string' && /^\s+$/.test(previous)) {
        normalized[normalized.length - 1] = `${previous}${node}`
      } else {
        normalized.push(node)
      }
      return
    }
    normalized.push(node)
  })

  const trimmed = trimTrailingWhitespaceNodes(normalized).filter(
    (node, index) => {
      if (index !== 0 || typeof node !== 'string' || !/^\s+$/.test(node)) {
        return true
      }
      return false
    },
  )

  const compacted = trimmed.map((node) => {
    if (typeof node !== 'string' || !/^\s+$/.test(node)) {
      return node
    }

    const newlineCount = (node.match(/\n/g) ?? []).length
    return newlineCount > 1 ? '\n' : node
  })

  if (compacted.length === 0) {
    return ''
  }
  if (compacted.length === 1) {
    return compacted[0]
  }
  // Preserve semantic block fragments as the reconciliation boundary. A
  // positional wrapper here would make streaming updates reconcile against
  // `markdown-out-*` keys instead of the stable `markdown-block-*` keys.
  return compacted
}

export function renderMarkdown(
  markdown: string,
  options: MarkdownRenderOptions = {},
): ReactNode {
  try {
    const basePalette = options.theme
      ? createMarkdownPalette(options.theme)
      : defaultPalette
    const palette = resolvePalette(basePalette, options.palette)
    const codeBlockWidth = options.codeBlockWidth ?? 80
    const syntaxStyle = options.theme
      ? createSyntaxStyle(options.theme)
      : undefined
    const state = createRenderState(palette, codeBlockWidth, syntaxStyle)
    const ast = processor.parse(markdown) as Root
    applyInlineFallbackFormatting(ast as unknown as MarkdownNode)
    const nodes = renderNode(ast as unknown as MarkdownNode, state, ast.type)
    return normalizeOutput(nodes)
  } catch (error) {
    logger.error(
      {
        err: error,
        contentLength: markdown.length,
        preview: markdown.slice(0, 200),
      },
      'Failed to parse markdown — returning raw content',
    )
    return markdown
  }
}

export function hasMarkdown(content: string): boolean {
  return /[*_`#>\-+]|\[.*\]\(.*\)|```/.test(content)
}

export function hasIncompleteCodeFence(content: string): boolean {
  let fenceCount = 0
  const fenceRegex = /```/g
  while (fenceRegex.exec(content)) {
    fenceCount += 1
  }
  return fenceCount % 2 === 1
}

export interface StreamingMarkdownBlock {
  key: string
  kind: string
}

/**
 * Returns stable semantic identities for the completed portion of a streaming
 * Markdown document. The identity is based on document order and block kind,
 * not the number of tokens received after the block.
 */
export function getStreamingMarkdownBlockManifest(
  content: string,
): StreamingMarkdownBlock[] {
  try {
    const stableContent = hasIncompleteCodeFence(content)
      ? content.slice(0, content.lastIndexOf('```'))
      : content
    const ast = processor.parse(stableContent) as Root
    return ast.children.map((node, index) => ({
      key: `markdown-block-${index}-${node.type}`,
      kind: node.type,
    }))
  } catch {
    return []
  }
}

const KeyedFragment = React.Fragment as React.FC<{
  key?: string | number
  children?: ReactNode
}>

const mergeStreamingSegments = (segments: ReactNode[]): ReactNode => {
  if (segments.length === 0) {
    return ''
  }
  if (segments.length === 1) {
    return segments[0]
  }

  return (
    <>
      <KeyedFragment key="stream-stable-prefix">{segments[0]}</KeyedFragment>
      <KeyedFragment key="stream-pending-region">{segments[1]}</KeyedFragment>
    </>
  )
}

export function renderStreamingMarkdown(
  content: string,
  options: MarkdownRenderOptions = {},
): ReactNode {
  if (!hasMarkdown(content)) {
    return content
  }

  if (!hasIncompleteCodeFence(content)) {
    return renderMarkdown(content, options)
  }

  const lastFenceIndex = content.lastIndexOf('```')
  if (lastFenceIndex === -1) {
    return renderMarkdown(content, options)
  }

  const completeSection = content.slice(0, lastFenceIndex)
  const pendingSection = content.slice(lastFenceIndex)

  const segments: ReactNode[] = []

  if (completeSection.length > 0) {
    segments.push(renderMarkdown(completeSection, options))
  }

  if (pendingSection.length > 0) {
    segments.push(pendingSection)
  }

  return mergeStreamingSegments(segments)
}

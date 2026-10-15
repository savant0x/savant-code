import React, { type ReactNode } from 'react'

import { renderExpandedContent } from './block-helpers'
import {
  collectSemanticBlocks,
  getSemanticKey,
  renderInlineTextHost,
  renderSemanticBlock,
} from './markdown-content-core'

import type { ChatTheme } from '../../types/theme-system'

interface MarkdownContentProps {
  value: ReactNode
  theme: Pick<ChatTheme, 'foreground'>
  getAttributes: (extra?: number) => number | undefined
  textColor?: string
  keyPrefix?: string
}

/**
 * Markdown-only OpenTUI adapter. It keeps semantic Markdown fragments as the
 * reconciliation boundary, uses one styled text host per flowing row, and
 * leaves generic custom/tool/agent renderables on renderExpandedContent.
 */
export function renderMarkdownContent({
  value,
  theme,
  getAttributes,
  textColor = theme.foreground,
  keyPrefix = 'markdown-content',
}: MarkdownContentProps): ReactNode {
  const blocks: ReactNode[] = []
  collectSemanticBlocks(value, blocks)

  const renderedBlocks = blocks
    .map((block, index) => {
      const semanticKey = getSemanticKey(block)
      if (semanticKey) {
        return renderSemanticBlock(
          block as React.ReactElement<{ children?: ReactNode }>,
          semanticKey,
          theme,
          getAttributes,
          textColor,
          `${keyPrefix}-${index}`,
        )
      }

      if (typeof block === 'string' || typeof block === 'number') {
        return renderInlineTextHost(
          block,
          textColor,
          getAttributes,
          `${keyPrefix}-plain-${index}`,
        )
      }

      return renderExpandedContent(
        block,
        theme,
        getAttributes,
        textColor,
        `${keyPrefix}-custom-${index}`,
      )
    })
    .filter((block): block is ReactNode => block !== null)

  if (renderedBlocks.length === 0) {
    return null
  }

  const children: ReactNode[] = []
  renderedBlocks.forEach((block, index) => {
    children.push(block)
    if (index < renderedBlocks.length - 1) {
      children.push(
        <text
          key={`${keyPrefix}-separator-${index}`}
          style={{ wrapMode: 'none' }}
        >
          {'\n'}
        </text>,
      )
    }
  })

  return (
    <box
      key={keyPrefix}
      style={{ flexDirection: 'column', gap: 0, width: '100%' }}
    >
      {children}
    </box>
  )
}

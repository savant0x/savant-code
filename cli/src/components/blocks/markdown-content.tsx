import { TextAttributes } from '@opentui/core'
import React, { type ReactNode } from 'react'

import {
  extractInlineTextSegments,
  renderExpandedContent,
} from './block-helpers'
import { MarkdownLink } from './markdown-renderables'

import type { ChatTheme } from '../../types/theme-system'

interface MarkdownContentProps {
  value: ReactNode
  theme: Pick<ChatTheme, 'foreground'>
  getAttributes: (extra?: number) => number | undefined
  textColor?: string
  keyPrefix?: string
}

type MarkdownPart =
  { kind: 'inline'; value: ReactNode[] } | { kind: 'layout'; value: ReactNode }

const isFragment = (
  value: ReactNode,
): value is React.ReactElement<{
  children?: ReactNode
}> => React.isValidElement(value) && value.type === React.Fragment

const getSemanticKey = (value: ReactNode): string | undefined => {
  if (!isFragment(value)) {
    return undefined
  }
  const key = value.key
  return typeof key === 'string' && key.startsWith('markdown-block-')
    ? key
    : undefined
}

const collectSemanticBlocks = (value: ReactNode, blocks: ReactNode[]): void => {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return
  }

  if (Array.isArray(value)) {
    value.forEach((child) => collectSemanticBlocks(child, blocks))
    return
  }

  if (getSemanticKey(value)) {
    blocks.push(value)
    return
  }

  if (isFragment(value)) {
    collectSemanticBlocks(value.props.children, blocks)
    return
  }

  blocks.push(value)
}

const hasInteractiveDescendant = (value: ReactNode): boolean => {
  if (Array.isArray(value)) return value.some(hasInteractiveDescendant)
  if (!React.isValidElement(value)) return false
  if (value.type === MarkdownLink) return true
  return hasInteractiveDescendant(
    (value.props as { children?: ReactNode }).children,
  )
}

const isInlineElement = (value: ReactNode): boolean => {
  if (!React.isValidElement(value)) {
    return false
  }
  return (
    (value.type === 'span' || value.type === 'strong' || value.type === 'em') &&
    !hasInteractiveDescendant(value)
  )
}

const isLayoutElement = (value: ReactNode): boolean =>
  React.isValidElement(value) && value.type === 'code'

const flushInline = (parts: MarkdownPart[], values: ReactNode[]): void => {
  if (values.length > 0) {
    parts.push({ kind: 'inline', value: [...values] })
    values.length = 0
  }
}

const collectMarkdownParts = (
  value: ReactNode,
  parts: MarkdownPart[],
  inlineValues: ReactNode[],
  inheritedAttributes = 0,
): void => {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return
  }

  if (Array.isArray(value)) {
    value.forEach((child) =>
      collectMarkdownParts(child, parts, inlineValues, inheritedAttributes),
    )
    return
  }

  if (isFragment(value)) {
    collectMarkdownParts(
      value.props.children,
      parts,
      inlineValues,
      inheritedAttributes,
    )
    return
  }

  if (React.isValidElement(value)) {
    const props = value.props as { children?: ReactNode }
    const ownAttributes =
      value.type === 'strong'
        ? TextAttributes.BOLD
        : value.type === 'em'
          ? TextAttributes.ITALIC
          : 0

    if (value.type === MarkdownLink) {
      flushInline(parts, inlineValues)
      parts.push({
        kind: 'layout',
        value: React.cloneElement(
          value as React.ReactElement<{ attributes?: number }>,
          { attributes: inheritedAttributes },
        ),
      })
      return
    }

    if (
      (value.type === 'span' ||
        value.type === 'strong' ||
        value.type === 'em') &&
      hasInteractiveDescendant(value)
    ) {
      collectMarkdownParts(
        props.children,
        parts,
        inlineValues,
        inheritedAttributes | ownAttributes,
      )
      return
    }
  }

  if (isLayoutElement(value)) {
    flushInline(parts, inlineValues)
    parts.push({ kind: 'layout', value })
    return
  }

  if (React.isValidElement(value) && !isInlineElement(value)) {
    flushInline(parts, inlineValues)
    parts.push({ kind: 'layout', value })
    return
  }

  if (inheritedAttributes !== 0) {
    inlineValues.push(<span attributes={inheritedAttributes}>{value}</span>)
  } else {
    inlineValues.push(value)
  }
}

const renderInlineTextHost = (
  value: ReactNode,
  textColor: string,
  getAttributes: (extra?: number) => number | undefined,
  key: string,
): ReactNode => {
  const segments = extractInlineTextSegments(value, textColor, getAttributes)

  while (
    segments.length > 0 &&
    /^\n+$/.test(segments[segments.length - 1].text)
  ) {
    segments.pop()
  }
  if (segments.length > 0) {
    segments[segments.length - 1].text = segments[
      segments.length - 1
    ].text.replace(/\n+$/g, '')
  }

  if (
    segments.length === 0 ||
    segments.every((segment) => segment.text.length === 0)
  ) {
    return null
  }

  return (
    <text key={key} style={{ wrapMode: 'word' }}>
      {segments.map((segment, index) => (
        <span
          key={`${key}-segment-${index}`}
          fg={segment.fg}
          bg={segment.bg}
          attributes={segment.attributes}
        >
          {segment.text}
        </span>
      ))}
    </text>
  )
}

const renderInlinePart = (
  value: ReactNode[],
  textColor: string,
  getAttributes: (extra?: number) => number | undefined,
  key: string,
): ReactNode => renderInlineTextHost(value, textColor, getAttributes, key)

const isInlineLayoutValue = (value: ReactNode): boolean =>
  React.isValidElement(value) && value.type === MarkdownLink

const renderSemanticBlock = (
  value: React.ReactElement<{ children?: ReactNode }>,
  semanticKey: string,
  theme: Pick<ChatTheme, 'foreground'>,
  getAttributes: (extra?: number) => number | undefined,
  textColor: string,
  keyPrefix: string,
): ReactNode => {
  const kind = semanticKey.slice(semanticKey.lastIndexOf('-') + 1)
  const parts: MarkdownPart[] = []
  const inlineValues: ReactNode[] = []
  collectMarkdownParts(value.props.children, parts, inlineValues)
  flushInline(parts, inlineValues)

  const renderedParts = parts
    .map((part, index) =>
      part.kind === 'inline'
        ? renderInlinePart(
            part.value,
            textColor,
            getAttributes,
            `${keyPrefix}-${kind}-row-${index}`,
          )
        : renderExpandedContent(
            part.value,
            theme,
            getAttributes,
            textColor,
            `${semanticKey}-layout-${index}`,
          ),
    )
    .filter((part): part is ReactNode => part !== null)

  if (renderedParts.length === 0) {
    return null
  }

  const compactInlineFlow =
    kind === 'paragraph' &&
    parts.every(
      (part) => part.kind === 'inline' || isInlineLayoutValue(part.value),
    )

  return (
    <box
      key={semanticKey}
      style={{
        flexDirection: compactInlineFlow ? 'row' : 'column',
        flexWrap: compactInlineFlow ? 'wrap' : undefined,
        gap: 0,
        width: '100%',
      }}
    >
      {renderedParts}
    </box>
  )
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

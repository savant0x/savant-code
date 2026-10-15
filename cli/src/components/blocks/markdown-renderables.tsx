import { TextAttributes } from '@opentui/core'
import React, { type ReactNode } from 'react'

import { MarkdownImage } from './markdown-image'
import { useTheme } from '../../hooks/use-theme'
import { safeOpen } from '../../utils/open-url'
import { Button } from '../button'

export { MarkdownImage }

const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

export function isSafeMarkdownLink(value: string): boolean {
  try {
    return SAFE_LINK_PROTOCOLS.has(new URL(value).protocol)
  } catch {
    return false
  }
}

interface MarkdownHeadingProps {
  depth: number
  color: string
  children: ReactNode
}

const flattenHeadingChildren = (value: ReactNode): ReactNode[] => {
  if (Array.isArray(value)) return value.flatMap(flattenHeadingChildren)
  if (value === null || value === undefined || typeof value === 'boolean') {
    return []
  }
  if (React.isValidElement(value) && value.type === React.Fragment) {
    return flattenHeadingChildren(
      (value.props as { children?: ReactNode }).children,
    )
  }
  return [value]
}

const containsMarkdownLink = (value: ReactNode): boolean => {
  if (Array.isArray(value)) return value.some(containsMarkdownLink)
  if (!React.isValidElement(value)) return false
  if (value.type === MarkdownLink) return true
  return containsMarkdownLink(
    (value.props as { children?: ReactNode }).children,
  )
}

const renderHeadingContent = (
  children: ReactNode,
  color: string,
  attributes: number,
): ReactNode[] => {
  const content: ReactNode[] = []
  let textNodes: ReactNode[] = []
  const flushText = (): void => {
    if (textNodes.length === 0) return
    content.push(
      <text
        key={`heading-text-${content.length}`}
        fg={color}
        style={{ wrapMode: 'word', flexShrink: 1 }}
        attributes={attributes}
      >
        {textNodes}
      </text>,
    )
    textNodes = []
  }

  flattenHeadingChildren(children).forEach((child) => {
    if (React.isValidElement(child) && containsMarkdownLink(child)) {
      flushText()
      // Emphasis wrappers may contain an interactive link. Flatten only that
      // wrapper so the Button remains a legal sibling of text, never a child
      // of an OpenTUI <text> host.
      if (child.type !== MarkdownLink) {
        content.push(
          ...renderHeadingContent(
            (child.props as { children?: ReactNode }).children,
            color,
            attributes,
          ),
        )
      } else {
        content.push(
          React.cloneElement(
            child as React.ReactElement<{ attributes?: number }>,
            { attributes },
          ),
        )
      }
    } else {
      textNodes.push(child)
    }
  })
  flushText()

  return content
}

export function MarkdownHeading({
  depth,
  color,
  children,
}: MarkdownHeadingProps): ReactNode {
  const clampedDepth = Math.max(1, Math.min(6, depth))
  const marker =
    clampedDepth === 1 ? '◆ ' : `${'  '.repeat(clampedDepth - 2)}▸ `
  const attributes =
    clampedDepth === 1
      ? TextAttributes.BOLD | TextAttributes.UNDERLINE
      : clampedDepth <= 3
        ? TextAttributes.BOLD
        : TextAttributes.DIM

  return (
    <box
      style={{
        flexDirection: 'row',
        width: '100%',
        marginTop: clampedDepth <= 2 ? 1 : 0,
        marginBottom: 0,
      }}
    >
      <text fg={color} style={{ wrapMode: 'none' }} attributes={attributes}>
        {marker}
      </text>
      <box
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          flexGrow: 1,
          flexShrink: 1,
          gap: 0,
        }}
      >
        {renderHeadingContent(children, color, attributes)}
      </box>
    </box>
  )
}

interface MarkdownLinkProps {
  href: string
  children: ReactNode
  attributes?: number
}

export function MarkdownLink({
  href,
  children,
  attributes,
}: MarkdownLinkProps): ReactNode {
  const theme = useTheme()
  const isSafe = isSafeMarkdownLink(href)

  return (
    <Button
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
        paddingLeft: 0,
        paddingRight: 0,
      }}
      onClick={isSafe ? () => void safeOpen(href) : undefined}
    >
      <text style={{ wrapMode: 'word', flexShrink: 1 }}>
        <span
          fg={isSafe ? theme.link : theme.muted}
          attributes={TextAttributes.UNDERLINE | (attributes ?? 0)}
        >
          {children}
        </span>
        <span fg={isSafe ? theme.link : theme.muted}> ↗</span>
      </text>
    </Button>
  )
}

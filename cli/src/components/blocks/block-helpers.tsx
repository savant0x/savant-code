import { TextAttributes } from '@opentui/core'
import React from 'react'

import type { ChatTheme } from '../../types/theme-system'

type ExpandedContentTheme = Pick<ChatTheme, 'foreground'>

// Re-export from block-processor for backwards compatibility
export { isReasoningTextBlock } from '../../utils/block-processor'

export function trimNewlines(str: string): string {
  return str.replace(/^\n+|\n+$/g, '')
}

export function sanitizePreview(text: string): string {
  return text.replace(/[#*_`~\[\]()]/g, '').trim()
}

interface InlineTextProps {
  children?: React.ReactNode
  fg?: string
  bg?: string
  attributes?: number
}

interface InlineTextSegment {
  text: string
  fg?: string
  bg?: string
  attributes?: number
}

const appendInlineTextSegments = (
  value: React.ReactNode,
  inherited: Omit<InlineTextSegment, 'text'>,
  segments: InlineTextSegment[],
): void => {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value)
    if (text.length > 0) {
      const previous = segments[segments.length - 1]
      if (
        previous &&
        previous.fg === inherited.fg &&
        previous.bg === inherited.bg &&
        previous.attributes === inherited.attributes
      ) {
        previous.text += text
      } else {
        segments.push({ text, ...inherited })
      }
    }
    return
  }

  if (Array.isArray(value)) {
    value.forEach((child) =>
      appendInlineTextSegments(child, inherited, segments),
    )
    return
  }

  if (React.isValidElement(value)) {
    const props = value.props as InlineTextProps
    const ownAttributes =
      props.attributes ??
      (value.type === 'strong'
        ? TextAttributes.BOLD
        : value.type === 'em'
          ? TextAttributes.ITALIC
          : 0)
    const nextAttributes = (inherited.attributes ?? 0) | ownAttributes
    appendInlineTextSegments(
      props.children,
      {
        fg: props.fg ?? inherited.fg,
        bg: props.bg ?? inherited.bg,
        attributes: nextAttributes || undefined,
      },
      segments,
    )
  }
}

export const extractInlineTextSegments = (
  value: React.ReactNode,
  textColor: string,
  getAttributes: (extra?: number) => number | undefined,
): InlineTextSegment[] => {
  const segments: InlineTextSegment[] = []
  appendInlineTextSegments(
    value,
    { fg: textColor, attributes: getAttributes() },
    segments,
  )
  return segments.map((segment) => ({
    ...segment,
    attributes: getAttributes(segment.attributes),
  }))
}

export const isTextRenderable = (value: React.ReactNode): boolean => {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return false
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return true
  }

  if (Array.isArray(value)) {
    return value.every(
      (child) =>
        typeof child === 'string' ||
        typeof child === 'number',
    )
  }

  // OpenTUI text hosts accept primitive text, but markdown elements/fragments
  // may contain layout nodes (for example code blocks). Keep every React
  // element under a box so a later markdown shape cannot crash the renderer.
  return false
}

export const renderExpandedContent = (
  value: React.ReactNode,
  theme: ExpandedContentTheme,
  getAttributes: (extra?: number) => number | undefined,
  textColor: string = theme.foreground,
  key?: string,
): React.ReactNode => {
  if (
    value === null ||
    value === undefined ||
    value === false ||
    value === true
  ) {
    return null
  }

  if (isTextRenderable(value)) {
    return (
      <text
        fg={textColor}
        key={key ?? 'expanded-text'}
        style={{ wrapMode: 'word' }}
        attributes={getAttributes()}
      >
        {Array.isArray(value) ? value.join('') : String(value)}
      </text>
    )
  }

  if (React.isValidElement(value)) {
    const element = value as React.ReactElement<{ children?: React.ReactNode }>

    // Fragments are transparent to React but not to OpenTUI's host
    // validation. Recursively normalize their children instead of placing
    // inline spans directly under a box.
    if (element.type === React.Fragment) {
      return renderExpandedContent(
        element.props.children,
        theme,
        getAttributes,
        textColor,
        key,
      )
    }

    // Markdown inline elements (`span`, `strong`, `em`) must live inside a
    // text host. Layout elements such as OpenTUI `code` remain direct box
    // children and are therefore safe to return unchanged.
    if (
      element.type === 'span' ||
      element.type === 'strong' ||
      element.type === 'em'
    ) {
      const segments = extractInlineTextSegments(
        element,
        textColor,
        getAttributes,
      )

      if (segments.length === 0) {
        return null
      }

      const textNodes = segments.map((segment, index) => (
        <text
          fg={segment.fg}
          bg={segment.bg}
          key={`${key ?? 'expanded-inline'}-${index}`}
          style={{ wrapMode: 'word' }}
          attributes={segment.attributes}
        >
          {segment.text}
        </text>
      ))

      return textNodes.length === 1 ? (
        textNodes[0]
      ) : (
        <box
          key={key ?? 'expanded-inline'}
          style={{ flexDirection: 'row', gap: 0 }}
        >
          {textNodes}
        </box>
      )
    }

    if (element.type === 'code') {
      return value
    }

    return (
      <box
        key={key ?? 'expanded-node'}
        style={{ flexDirection: 'column', gap: 0 }}
      >
        {value}
      </box>
    )
  }

  if (Array.isArray(value)) {
    return (
      <box
        key={key ?? 'expanded-array'}
        style={{ flexDirection: 'column', gap: 0 }}
      >
        {value.map((child, idx) => (
          <React.Fragment key={`expanded-array-${idx}`}>
            {renderExpandedContent(
              child,
              theme,
              getAttributes,
              textColor,
              `expanded-array-${idx}`,
            )}
          </React.Fragment>
        ))}
      </box>
    )
  }

  return (
    <box
      key={key ?? 'expanded-unknown'}
      style={{ flexDirection: 'column', gap: 0 }}
    >
      {value}
    </box>
  )
}

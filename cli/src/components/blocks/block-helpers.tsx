import React from 'react'

import type { ChatTheme } from '../../types/theme-system'

// Re-export from block-processor for backwards compatibility
export { isReasoningTextBlock } from '../../utils/block-processor'

export function trimNewlines(str: string): string {
  return str.replace(/^\n+|\n+$/g, '')
}

export function sanitizePreview(text: string): string {
  return text.replace(/[#*_`~\[\]()]/g, '').trim()
}

export const isTextRenderable = (value: React.ReactNode): boolean => {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return false
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return true
  }

  if (Array.isArray(value)) {
    return value.every((child) => isTextRenderable(child))
  }

  if (React.isValidElement(value)) {
    const elProps = value.props as Record<string, unknown>
    if (value.type === React.Fragment) {
      return isTextRenderable(elProps.children as React.ReactNode)
    }

    if (typeof value.type === 'string') {
      if (
        value.type === 'span' ||
        value.type === 'strong' ||
        value.type === 'em'
      ) {
        return isTextRenderable(elProps.children as React.ReactNode)
      }

      return false
    }
  }

  return false
}

export const renderExpandedContent = (
  value: React.ReactNode,
  theme: ChatTheme,
  getAttributes: (extra?: number) => number | undefined,
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
        fg={theme.foreground}
        key="expanded-text"
        attributes={getAttributes()}
      >
        {value}
      </text>
    )
  }

  if (React.isValidElement(value)) {
    if (value.key === null || value.key === undefined) {
      return (
        <box
          key="expanded-node"
          style={{ flexDirection: 'column', gap: 0 }}
        >
          {value}
        </box>
      )
    }
    return value
  }

  if (Array.isArray(value)) {
    return (
      <box
        key="expanded-array"
        style={{ flexDirection: 'column', gap: 0 }}
      >
        {value.map((child, idx) => (
          <box
            key={`expanded-array-${idx}`}
            style={{ flexDirection: 'column', gap: 0 }}
          >
            {child}
          </box>
        ))}
      </box>
    )
  }

  return (
    <box
      key="expanded-unknown"
      style={{ flexDirection: 'column', gap: 0 }}
    >
      {value}
    </box>
  )
}

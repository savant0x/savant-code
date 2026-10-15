import { TextAttributes } from '@opentui/core'
import React from 'react'

import { useTheme } from '../../../hooks/use-theme'

export interface KeyHintProps {
  /** The keyboard shortcut shown inside brackets (e.g., "Esc", "Enter"). */
  shortcut?: string
  /** Optional label shown after the shortcut brackets. */
  label?: string
  /** Whether the hint text should be bold. */
  bold?: boolean
}

/**
 * Renders a clean, bracketed keyboard hint.
 *
 * Example: `<KeyHint shortcut="Esc" />` → `[Esc]`
 * Example: `<KeyHint shortcut="End" label="session" />` → `[End] session`
 *
 * Uses OpenTUI `<span>` children inside a single `<text>` so the brackets and
 * shortcut share one text node, while the optional label sits in a sibling
 * `<text>` to avoid nesting text inside text.
 */
export function KeyHint({ shortcut, label, bold }: KeyHintProps) {
  const theme = useTheme()
  const attributes = bold ? TextAttributes.BOLD : TextAttributes.NONE

  return (
    <box flexDirection="row" gap={1} alignItems="center">
      {shortcut ? (
        <text attributes={attributes} selectable={false}>
          <span fg={theme.muted}>[</span>
          <span fg={theme.primary}>{shortcut}</span>
          <span fg={theme.muted}>]</span>
        </text>
      ) : null}
      {label ? (
        <text fg={theme.secondary} attributes={attributes} selectable={false}>
          {label}
        </text>
      ) : null}
    </box>
  )
}

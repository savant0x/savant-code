import { TextAttributes } from '@opentui/core'
import React from 'react'

import { scalarToDisplayString } from './classify'
import { RichTextValue } from './rich-text'

import type { ChatTheme } from '../../../types/theme-system'
import type { JSONValue } from '@savant-code/common/types/json'

/**
 * FID-2026-0822-014 — shared typographic hierarchy primitives for the
 * structured output cards: dimmed keys, bold values, and an indented
 * sub-grid with a left border line for nested shapes. Contract tokens only.
 */

interface KeyValueRowProps {
  label: string
  value: JSONValue
  theme: ChatTheme
  /** Fixed key-column width for two-column alignment within one record. */
  labelWidth?: number
}

/** One dim-key / bold-value row of the card hierarchy. */
export function KeyValueRow({
  label,
  value,
  theme,
  labelWidth,
}: KeyValueRowProps): React.ReactNode {
  return (
    <box style={{ flexDirection: 'row', gap: 1 }}>
      <text fg={theme.muted} style={{ wrapMode: 'none', width: labelWidth }}>
        {label}
      </text>
      <RichTextValue
        value={value}
        theme={theme}
        fallback={
          <text
            fg={theme.foreground}
            attributes={TextAttributes.BOLD}
            style={{ wrapMode: 'word' }}
          >
            {scalarToDisplayString(value)}
          </text>
        }
      />
    </box>
  )
}

/** Muted secondary text (chips, hints, collapse affordances). */
export function MutedText({
  children,
  theme,
}: {
  children: React.ReactNode
  theme: ChatTheme
}): React.ReactNode {
  return (
    <text fg={theme.muted} style={{ wrapMode: 'word' }}>
      {children}
    </text>
  )
}

/** Bold foreground primary content (messages, error headlines). */
export function PrimaryText({
  children,
  theme,
}: {
  children: React.ReactNode
  theme: ChatTheme
}): React.ReactNode {
  return (
    <text
      fg={theme.foreground}
      attributes={TextAttributes.BOLD}
      style={{ wrapMode: 'word' }}
    >
      {children}
    </text>
  )
}

interface IndentBlockProps {
  theme: ChatTheme
  children: React.ReactNode
}

/**
 * Nested-shape container: a subtle left border line instead of YAML dash
 * markers, content indented under it (same accent-bar pattern as the agent
 * branch prompt).
 */
export function IndentBlock({
  theme,
  children,
}: IndentBlockProps): React.ReactNode {
  return (
    <box style={{ flexDirection: 'row', alignItems: 'stretch' }}>
      <box style={{ width: 1, backgroundColor: theme.border }} />
      <box
        style={{
          paddingLeft: 1,
          flexGrow: 1,
          flexDirection: 'column',
          gap: 0,
        }}
      >
        {children}
      </box>
    </box>
  )
}

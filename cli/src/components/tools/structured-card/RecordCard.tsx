import { TextAttributes } from '@opentui/core'
import React from 'react'

import { isPlainObject, scalarToDisplayString } from './classify'
import { IndentBlock, KeyValueRow, MutedText } from './hierarchy'
import { RichTextValue } from './rich-text'

import type { StructuredCardProps } from './SuccessCard'
import type { ChatTheme } from '../../../types/theme-system'
import type { JSONValue } from '@savant-code/common/types/json'

/** Nesting deeper than this collapses into a muted count row (spec cap). */
const MAX_RENDER_DEPTH = 3

interface RecordCardProps extends StructuredCardProps {
  depth?: number
}

function countEntries(value: JSONValue): number {
  if (Array.isArray(value)) return value.length
  if (isPlainObject(value)) return Object.keys(value).length
  return 1
}

/**
 * FID-2026-0822-014 record card: two-column key-value grid (dimmed keys,
 * bold values). Nested shapes indent under a left border line instead of
 * YAML dash markers; beyond MAX_RENDER_DEPTH they collapse to a count.
 * Unknown/scalar payloads degrade here as bold primary content (fail-open).
 */
export function RecordCard({
  value,
  theme,
  depth = 0,
}: RecordCardProps): React.ReactNode {
  if (!isPlainObject(value)) {
    return (
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
    )
  }
  const entries = Object.entries(value)
  if (entries.length === 0) return null
  const labelWidth = Math.max(...entries.map(([key]) => key.length))
  return (
    <box style={{ flexDirection: 'column', gap: 0 }}>
      {entries.map(([key, entry]) => (
        <RecordEntry
          key={key}
          label={key}
          entry={entry}
          theme={theme}
          depth={depth}
          labelWidth={labelWidth}
        />
      ))}
    </box>
  )
}

interface RecordEntryProps {
  label: string
  entry: JSONValue
  theme: ChatTheme
  depth: number
  labelWidth: number
}

function RecordEntry({
  label,
  entry,
  theme,
  depth,
  labelWidth,
}: RecordEntryProps): React.ReactNode {
  const nested = isPlainObject(entry) || Array.isArray(entry)
  if (nested && depth >= MAX_RENDER_DEPTH) {
    return (
      <box style={{ flexDirection: 'row', gap: 1 }}>
        <text fg={theme.muted} style={{ wrapMode: 'none', width: labelWidth }}>
          {label}
        </text>
        <MutedText
          theme={theme}
        >{`{…} ${countEntries(entry)} nested`}</MutedText>
      </box>
    )
  }
  if (nested) {
    return (
      <IndentBlock theme={theme}>
        <text fg={theme.muted} style={{ wrapMode: 'none' }}>
          {label}
        </text>
        {Array.isArray(entry) ? (
          <ListCardFallback entry={entry} theme={theme} depth={depth + 1} />
        ) : (
          <RecordCard value={entry} theme={theme} depth={depth + 1} />
        )}
      </IndentBlock>
    )
  }
  return (
    <KeyValueRow
      label={label}
      value={entry}
      theme={theme}
      labelWidth={labelWidth}
    />
  )
}

function ListCardFallback({
  entry,
  theme,
  depth,
}: {
  entry: JSONValue[]
  theme: ChatTheme
  depth: number
}): React.ReactNode {
  return <NestedItems items={entry} theme={theme} depth={depth} />
}

function NestedItems({
  items,
  theme,
  depth,
}: {
  items: JSONValue[]
  theme: ChatTheme
  depth: number
}): React.ReactNode {
  const rows = items.map((item, index) =>
    isPlainObject(item) ? (
      <RecordCard key={index} value={item} theme={theme} depth={depth} />
    ) : (
      <RichTextValue
        key={index}
        value={item}
        theme={theme}
        fallback={
          <text fg={theme.foreground} style={{ wrapMode: 'word' }}>
            {scalarToDisplayString(item)}
          </text>
        }
      />
    ),
  )
  return <box style={{ flexDirection: 'column', gap: 0 }}>{rows}</box>
}

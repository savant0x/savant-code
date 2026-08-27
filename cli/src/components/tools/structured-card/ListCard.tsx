import React from 'react'

import { isPlainObject, scalarToDisplayString } from './classify'
import { ReceiptCollapse } from './collapse'
import { KeyValueRow, MutedText } from './hierarchy'
import { RichTextValue } from './rich-text'

import type { StructuredCardProps } from './SuccessCard'
import type { ChatTheme } from '../../../types/theme-system'
import type { JSONValue } from '@savant-code/common/types/json'

function ListRow({
  item,
  theme,
}: {
  item: JSONValue
  theme: ChatTheme
}): React.ReactNode {
  if (isPlainObject(item)) {
    const entries = Object.entries(item)
    return (
      <box style={{ flexDirection: 'column', gap: 0 }}>
        {entries.map(([key, entry]) => (
          <KeyValueRow key={key} label={key} value={entry} theme={theme} />
        ))}
      </box>
    )
  }
  return (
    <box style={{ flexDirection: 'row', gap: 1 }}>
      <text fg={theme.muted} style={{ wrapMode: 'none' }}>
        {'•'}
      </text>
      <RichTextValue
        value={item}
        theme={theme}
        fallback={
          <text fg={theme.foreground} style={{ wrapMode: 'word' }}>
            {scalarToDisplayString(item)}
          </text>
        }
      />
    </box>
  )
}

/**
 * FID-2026-0822-014 list card: muted count chip on the top row (inside the
 * panel content area — the lights title bar stays untouched), then one row
 * per item (scalar bullet or mini-record). Beyond COLLAPSE_ITEM_THRESHOLD
 * rows receipt-collapse applies with a snap expand toggle.
 */
export function ListCard({
  value,
  theme,
}: StructuredCardProps): React.ReactNode {
  const items = Array.isArray(value) ? value : [value]
  const rows = items.map((item, index) => (
    <ListRow key={index} item={item} theme={theme} />
  ))
  return (
    <box style={{ flexDirection: 'column', gap: 0 }}>
      <box style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <MutedText theme={theme}>{`${items.length} items`}</MutedText>
      </box>
      <ReceiptCollapse items={rows} theme={theme} />
    </box>
  )
}

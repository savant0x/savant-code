import React from 'react'

import { isPlainObject } from './classify'
import { KeyValueRow, PrimaryText } from './hierarchy'
import { RichTextValue } from './rich-text'

import type { ChatTheme } from '../../../types/theme-system'
import type { JSONValue } from '@savant-code/common/types/json'

export interface StructuredCardProps {
  value: JSONValue
  theme: ChatTheme
}

/**
 * FID-2026-0822-014 success card: `✓` glyph (theme.success) + message as
 * bold foreground primary content; remaining scalar fields as KeyValue rows.
 */
export function SuccessCard({
  value,
  theme,
}: StructuredCardProps): React.ReactNode {
  if (!isPlainObject(value)) return null
  const extras = Object.entries(value).filter(([key]) => key !== 'message')
  return (
    <box style={{ flexDirection: 'column', gap: 0 }}>
      <box style={{ flexDirection: 'row', gap: 1 }}>
        <text fg={theme.success} style={{ wrapMode: 'none' }}>
          {'✓'}
        </text>
        <RichTextValue
          value={value.message}
          theme={theme}
          fallback={
            <PrimaryText theme={theme}>{String(value.message)}</PrimaryText>
          }
        />
      </box>
      {extras.map(([key, extra]) => (
        <KeyValueRow key={key} label={key} value={extra} theme={theme} />
      ))}
    </box>
  )
}

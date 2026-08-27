import React from 'react'

import { isPlainObject, scalarToDisplayString } from './classify'
import { KeyValueRow, PrimaryText } from './hierarchy'
import { RichTextValue } from './rich-text'

import type { StructuredCardProps } from './SuccessCard'

/**
 * FID-2026-0822-014 error card: theme.error accent border-left +
 * `errorMessage` bold and prominent; remaining fields as KeyValue rows.
 */
export function ErrorCard({
  value,
  theme,
}: StructuredCardProps): React.ReactNode {
  if (!isPlainObject(value)) {
    return (
      <box style={{ flexDirection: 'row', alignItems: 'stretch', gap: 1 }}>
        <box style={{ width: 1, backgroundColor: theme.error }} />
        <RichTextValue
          value={value}
          theme={theme}
          fallback={
            <text fg={theme.error} style={{ wrapMode: 'word' }}>
              {scalarToDisplayString(value)}
            </text>
          }
        />
      </box>
    )
  }
  const extras = Object.entries(value).filter(([key]) => key !== 'errorMessage')
  return (
    <box style={{ flexDirection: 'row', alignItems: 'stretch' }}>
      <box style={{ width: 1, backgroundColor: theme.error }} />
      <box
        style={{
          paddingLeft: 1,
          flexGrow: 1,
          flexDirection: 'column',
          gap: 0,
        }}
      >
        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text fg={theme.error} style={{ wrapMode: 'none' }}>
            {'✗'}
          </text>
          <RichTextValue
            value={value.errorMessage}
            theme={theme}
            fallback={
              <PrimaryText theme={theme}>
                {String(value.errorMessage)}
              </PrimaryText>
            }
          />
        </box>
        {extras.map(([key, extra]) => (
          <KeyValueRow key={key} label={key} value={extra} theme={theme} />
        ))}
      </box>
    </box>
  )
}

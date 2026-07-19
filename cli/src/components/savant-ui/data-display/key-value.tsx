import React from 'react'

import { useTheme } from '../../../hooks/use-theme'

export interface KeyValueItem {
  label: string
  value: React.ReactNode
  color?: string
}

export interface KeyValueProps {
  items: KeyValueItem[]
  separator?: string
  labelWidth?: number
}

export function KeyValue({ items, separator = '  ', labelWidth = 12 }: KeyValueProps) {
  const theme = useTheme()

  return (
    <box flexDirection="column">
      {items.map((item, i) => (
        <box key={i} flexDirection="row" gap={1}>
          <text fg={theme.muted}>
            {item.label.padEnd(labelWidth)}
          </text>
          <text fg={item.color ?? theme.foreground}>
            {item.value}
          </text>
        </box>
      ))}
    </box>
  )
}

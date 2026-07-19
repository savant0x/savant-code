import React from 'react'
import { TextAttributes } from '@opentui/core'

export interface Column {
  key: string
  label: string
  align?: 'left' | 'center' | 'right'
  width?: number
}

export interface GridProps {
  columns: Column[]
  data: Record<string, React.ReactNode>[]
  striped?: boolean
  bordered?: boolean
  [key: string]: any
}

export function Grid({
  columns,
  data,
  striped = false,
  bordered = false,
  ...props
}: GridProps) {
  return (
    <box flexDirection="column" {...props}>
      {bordered && (
        <box flexDirection="row">
          {columns.map((col) => (
            <text key={col.key} attributes={TextAttributes.BOLD}>
              {col.label.padEnd(col.width ?? 15)}
            </text>
          ))}
        </box>
      )}
      {data.map((row, i) => (
        <box key={i} flexDirection="row">
          {columns.map((col) => (
            <text key={col.key}>
              {String(row[col.key] ?? '').padEnd(col.width ?? 15)}
            </text>
          ))}
        </box>
      ))}
    </box>
  )
}

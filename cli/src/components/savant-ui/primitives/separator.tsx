import React from 'react'

import { useTheme } from '../../../hooks/use-theme'

export interface SeparatorProps {
  direction?: 'horizontal' | 'vertical'
  length?: number
  color?: string
}

export function Separator({
  direction = 'horizontal',
  length,
  color,
}: SeparatorProps) {
  const theme = useTheme()
  const sepColor = color ?? theme.border

  if (direction === 'vertical') {
    return (
      <box width={1} height={length ?? 1}>
        <text fg={sepColor}>│</text>
      </box>
    )
  }

  const char = '─'
  const displayLength = length ?? 30
  return (
    <box>
      <text fg={sepColor}>{char.repeat(displayLength)}</text>
    </box>
  )
}

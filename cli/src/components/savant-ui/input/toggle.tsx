import React from 'react'

import { useTheme } from '../../../hooks/use-theme'

export interface ToggleProps {
  checked: boolean
  onChange?: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  const theme = useTheme()
  const color = checked ? theme.primary : theme.muted
  const icon = checked ? '◉' : '◎'

  return (
    <box flexDirection="row" gap={1}>
      <text fg={color}>{icon}</text>
      {label && <text fg={disabled ? theme.muted : theme.foreground}>{label}</text>}
    </box>
  )
}

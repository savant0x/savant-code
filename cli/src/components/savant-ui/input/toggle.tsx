import React from 'react'

import { useTheme } from '../../../hooks/use-theme'
import { glyph } from '../../../utils/glyphs'
import { resolveThemeColor } from '../icon-theme-keys'

export interface ToggleProps {
  checked: boolean
  onChange?: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  const theme = useTheme()
  const colorKey = checked ? 'primary' : 'muted'
  const color = resolveThemeColor(theme, colorKey)
  const icon = glyph(checked ? 'toggleOn' : 'toggleOff')

  return (
    <box flexDirection="row" gap={1}>
      <text fg={color}>{icon}</text>
      {label && <text fg={disabled ? theme.muted : theme.foreground}>{label}</text>}
    </box>
  )
}

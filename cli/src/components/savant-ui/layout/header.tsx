import { TextAttributes } from '@opentui/core'
import React from 'react'

import { useTheme } from '../../../hooks/use-theme'

export interface HeaderProps {
  title: string
  subtitle?: string
  actions?: Array<{ label: string; onClick?: () => void }>
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const theme = useTheme()
  return (
    <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
      <box flexDirection="row" gap={1}>
        <text attributes={TextAttributes.BOLD}>{title}</text>
        {subtitle && <text attributes={TextAttributes.DIM}>{subtitle}</text>}
      </box>
      {actions && actions.length > 0 && (
        <box flexDirection="row" gap={1}>
          {actions.map((action, i) => (
            <text key={i} fg={theme.primary}>
              [{action.label}]
            </text>
          ))}
        </box>
      )}
    </box>
  )
}

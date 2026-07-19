import React from 'react'

import { TextAttributes } from '@opentui/core'

import { useTheme } from '../../../hooks/use-theme'

export interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'error'
  title?: string
  message: string
}

const ICONS: Record<string, string> = {
  info: 'ℹ',
  success: '✓',
  warning: '⚠',
  error: '✗',
}

const TYPE_COLORS: Record<string, string> = {
  info: '#3b82f6',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
}

export function Alert({ type = 'info', title, message }: AlertProps) {
  const color = TYPE_COLORS[type]
  const icon = ICONS[type]

  return (
    <box flexDirection="row" gap={1}>
      <text fg={color}>{icon}</text>
      <box flexDirection="column">
        {title && <text fg={color} attributes={TextAttributes.BOLD}>{title}</text>}
        <text>{message}</text>
      </box>
    </box>
  )
}

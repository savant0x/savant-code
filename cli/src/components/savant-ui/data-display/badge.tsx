import React from 'react'

import { useTheme } from '../../../hooks/use-theme'

export interface BadgeProps {
  variant?:
    | 'open'
    | 'closed'
    | 'critical'
    | 'high'
    | 'medium'
    | 'low'
    | 'info'
    | 'success'
    | 'warning'
    | 'error'
  children: React.ReactNode
  pulse?: boolean
  brackets?: boolean
}

const VARIANT_COLORS: Record<string, string> = {
  open: '#18faf9',
  closed: '#22c55e',
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#6b7280',
  info: '#3b82f6',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
}

export function Badge({
  variant = 'info',
  children,
  pulse,
  brackets = true,
}: BadgeProps) {
  const theme = useTheme()
  const color = VARIANT_COLORS[variant] ?? theme.muted
  const prefix = pulse ? '● ' : ''
  const content = brackets ? `[${String(children)}]` : String(children)

  return (
    <text fg={color} selectable={false}>
      {prefix}
      {content}
    </text>
  )
}

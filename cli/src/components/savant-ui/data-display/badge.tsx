import React from 'react'

import { useTheme } from '../../../hooks/use-theme'

import type { ChatTheme } from '../../../types/theme-system'

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

// FID-2026-0822-007: severity variants resolve from ChatTheme semantic
// tokens (never inline hex). open=primary cyan, success-family=success,
// critical/error=error, high/warning=warning, medium/info=link blue,
// low=muted gray.
const VARIANT_TOKEN_KEYS: Record<string, keyof ChatTheme> = {
  open: 'primary',
  closed: 'success',
  critical: 'error',
  high: 'warning',
  medium: 'link',
  low: 'muted',
  info: 'link',
  success: 'success',
  warning: 'warning',
  error: 'error',
}

// The variant map only references string-valued color tokens; pick those to
// keep the indexed access a plain string (ChatTheme also carries non-color
// members like `markdown` and `messageTextAttributes`).
type ChatThemeColorKey = {
  [K in keyof ChatTheme]: ChatTheme[K] extends string ? K : never
}[keyof ChatTheme]

const COLOR_TOKEN_KEYS = VARIANT_TOKEN_KEYS as Record<string, ChatThemeColorKey>

export function Badge({
  variant = 'info',
  children,
  pulse,
  brackets = true,
}: BadgeProps) {
  const theme = useTheme()
  const color = theme[COLOR_TOKEN_KEYS[variant] ?? 'muted']
  const prefix = pulse ? '● ' : ''
  const content = brackets ? `[${String(children)}]` : String(children)

  return (
    <text fg={color} selectable={false}>
      {prefix}
      {content}
    </text>
  )
}

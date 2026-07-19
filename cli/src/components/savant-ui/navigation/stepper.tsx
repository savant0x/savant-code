import React from 'react'

import { useTheme } from '../../../hooks/use-theme'

export interface StepperStep {
  label: string
  status?: 'pending' | 'active' | 'done' | 'error'
}

export interface StepperProps {
  steps: StepperStep[]
  current?: number
}

const STATUS_ICONS: Record<string, { icon: string; color: string }> = {
  pending: { icon: '○', color: '#6b7280' },
  active: { icon: '●', color: '#18faf9' },
  done: { icon: '✓', color: '#22c55e' },
  error: { icon: '✗', color: '#ef4444' },
}

export function Stepper({ steps, current }: StepperProps) {
  const theme = useTheme()

  return (
    <box flexDirection="row" gap={0} alignItems="center">
      {steps.map((step, i) => {
        const status = step.status ?? (i === current ? 'active' : 'pending')
        const info = STATUS_ICONS[status]
        const isLast = i === steps.length - 1

        return (
          <box key={i} flexDirection="row" gap={0}>
            {!isLast && <text fg={theme.muted}> ── </text>}
            <text fg={info.color}>
              {info.icon} {step.label}
            </text>
          </box>
        )
      })}
    </box>
  )
}

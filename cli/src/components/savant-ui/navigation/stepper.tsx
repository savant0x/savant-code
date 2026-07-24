import React from 'react'

import { useTheme } from '../../../hooks/use-theme'
import { glyph } from '../../../utils/glyphs'
import { statusMapping } from '../echo/phase-info'
import { resolveThemeColor } from '../icon-theme-keys'

export interface StepperStep {
  label: string
  status?: 'pending' | 'active' | 'done' | 'error'
}

export interface StepperProps {
  steps: StepperStep[]
  current?: number
}

export function Stepper({ steps, current }: StepperProps) {
  const theme = useTheme()

  return (
    <box flexDirection="row" gap={0} alignItems="center">
      {steps.map((step, i) => {
        const status = step.status ?? (i === current ? 'active' : 'pending')
        const mapping = statusMapping(status)
        const color = resolveThemeColor(theme, mapping.colorKey)
        const icon = glyph(mapping.glyph)
        const isLast = i === steps.length - 1

        return (
          <box key={i} flexDirection="row" gap={0}>
            {!isLast && <text fg={theme.muted}> ── </text>}
            <text fg={color}>
              {icon} {step.label}
            </text>
          </box>
        )
      })}
    </box>
  )
}

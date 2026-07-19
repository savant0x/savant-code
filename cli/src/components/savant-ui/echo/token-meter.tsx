import React from 'react'

import { useTheme } from '../../../hooks/use-theme'
import { ProgressBar } from '../feedback/progress-bar'

export interface TokenMeterProps {
  used: number
  max: number
  label?: string
  warningThreshold?: number
  history?: number[]
}

export function TokenMeter({
  used,
  max,
  label = 'Context',
  warningThreshold = 0.7,
  history,
}: TokenMeterProps) {
  const theme = useTheme()
  const percent = max > 0 ? (used / max) * 100 : 0
  const isWarning = percent > warningThreshold * 100

  return (
    <box flexDirection="row" gap={1} alignItems="center">
      <ProgressBar
        value={used}
        max={max}
        label={label}
        width={12}
        color={isWarning ? theme.warning : undefined}
      />
      <text fg={theme.muted}>
        {`${(used / 1000).toFixed(1)}k/${(max / 1000).toFixed(1)}k`}
      </text>
    </box>
  )
}

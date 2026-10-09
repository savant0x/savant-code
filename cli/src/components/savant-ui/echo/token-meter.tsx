import React from 'react'

import { contextDisplay } from '../../right-sidebar-display'
import { useSidebarTheme as useTheme } from '../../right-sidebar-theme'
import { ProgressBar } from '../feedback/progress-bar'

export interface TokenMeterProps {
  used: number
  max: number
  label?: string
  warningThreshold?: number
  history?: number[]
  animate?: boolean
  centered?: boolean
}

export function TokenMeter({
  used,
  max,
  label = 'Context',
  warningThreshold = 0.7,
  animate = false,
  centered = false,
}: TokenMeterProps) {
  const theme = useTheme()
  const display = contextDisplay(used, max, warningThreshold)
  if (display.percent === undefined)
    return <text fg={theme.muted}>{`${label} · ${display.label}`}</text>
  const color =
    display.band === 'error'
      ? theme.error
      : display.band === 'warning'
        ? theme.warning
        : theme.primary

  return (
    <box flexDirection="column" alignItems={centered ? 'center' : undefined}>
      <text
        fg={color}
        wrapMode="word"
      >{`${label} · ${display.label} · ${Math.round(display.percent)}%`}</text>
      <ProgressBar
        value={used}
        max={max}
        width={24}
        color={color}
        animate={animate}
        showPercent={false}
      />
    </box>
  )
}

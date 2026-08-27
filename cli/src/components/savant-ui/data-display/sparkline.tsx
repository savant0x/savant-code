import React from 'react'

import { useTheme } from '../../../hooks/use-theme'

export interface SparklineProps {
  data: number[]
  width?: number
  /** Override color; defaults to the active theme's primary (FID-2026-0822-007). */
  color?: string
  label?: string
}

const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']

export function Sparkline({ data, width = 10, color, label }: SparklineProps) {
  const theme = useTheme()
  const resolvedColor = color ?? theme.primary
  if (data.length === 0) {
    return <text>No data</text>
  }

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const displayData = data.slice(-width)

  const chars = displayData.map((v) => {
    const normalized = (v - min) / range
    const index = Math.min(
      Math.floor(normalized * BLOCKS.length),
      BLOCKS.length - 1,
    )
    return BLOCKS[index]
  })

  return (
    <box flexDirection="row" gap={0}>
      {label && <text>{label}: </text>}
      <text fg={resolvedColor}>{chars.join('')}</text>
    </box>
  )
}

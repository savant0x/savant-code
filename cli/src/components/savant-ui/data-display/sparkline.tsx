import React from 'react'


export interface SparklineProps {
  data: number[]
  width?: number
  color?: string
  label?: string
}

const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']

export function Sparkline({ data, width = 10, color = '#18faf9', label }: SparklineProps) {
  if (data.length === 0) {
    return <text>No data</text>
  }

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const displayData = data.slice(-width)

  const chars = displayData.map((v) => {
    const normalized = (v - min) / range
    const index = Math.min(Math.floor(normalized * BLOCKS.length), BLOCKS.length - 1)
    return BLOCKS[index]
  })

  return (
    <box flexDirection="row" gap={0}>
      {label && <text>{label}: </text>}
      <text fg={color}>{chars.join('')}</text>
    </box>
  )
}

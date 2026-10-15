import React, { useEffect, useRef, useState } from 'react'

import { useAnimationTimeline } from '../../../hooks/use-animation-timeline'
import { useTheme } from '../../../hooks/use-theme'
import { activeGlyphTier } from '../../../utils/glyphs'

export interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  showPercent?: boolean
  width?: number
  color?: string
  animate?: boolean
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercent = true,
  width = 20,
  color,
  animate = true,
}: ProgressBarProps) {
  const theme = useTheme()
  const [displayValue, setDisplayValue] = useState(value)
  const startRef = useRef(value)

  const timeline = useAnimationTimeline({ duration: 300 })

  useEffect(() => {
    const start = startRef.current
    const end = value
    timeline.pause()
    timeline.items.length = 0
    if (!animate) {
      setDisplayValue(end)
      startRef.current = end
      return
    }
    if (start === end) return

    timeline.add(
      { value: start },
      {
        value: end,
        duration: 300,
        ease: 'outQuad',
        once: true,
        onUpdate: (anim) => {
          setDisplayValue(anim.targets[0]?.value ?? end)
        },
      },
    )
    timeline.restart()
    startRef.current = end
    return () => {
      timeline.pause()
    }
  }, [value, timeline, animate])

  const safeMax = Number.isFinite(max) && max > 0 ? max : 0
  const clampedValue = Math.min(
    Math.max(Number.isFinite(displayValue) ? displayValue : 0, 0),
    safeMax,
  )
  const percent =
    safeMax === 0
      ? 0
      : Math.min(Math.max((clampedValue / safeMax) * 100, 0), 100)
  const filled = Math.round((percent / 100) * width)
  const empty = width - filled

  let barColor = color ?? theme.success
  if (!color) {
    if (percent > 70) barColor = theme.error
    else if (percent > 40) barColor = theme.warning
  }

  return (
    <box flexDirection="row" gap={1}>
      {label && <text fg={theme.muted}>{label}</text>}
      <text fg={barColor}>
        {(activeGlyphTier() === 'ascii' ? '#' : '█').repeat(filled)}
        {(activeGlyphTier() === 'ascii' ? '.' : '░').repeat(empty)}
      </text>
      {showPercent && <text fg={theme.muted}>{percent.toFixed(0)}%</text>}
    </box>
  )
}

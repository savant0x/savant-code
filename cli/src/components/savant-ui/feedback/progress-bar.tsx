import { useTimeline } from '@opentui/react'
import React, { useEffect, useRef, useState } from 'react'

import { useTheme } from '../../../hooks/use-theme'

export interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  showPercent?: boolean
  width?: number
  color?: string
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercent = true,
  width = 20,
  color,
}: ProgressBarProps) {
  const theme = useTheme()
  const [displayValue, setDisplayValue] = useState(value)
  const startRef = useRef(value)

  const timeline = useTimeline({ autoplay: false })

  useEffect(() => {
    const start = startRef.current
    const end = value
    if (start === end) return

    timeline.once(
      { value: start },
      {
        value: end,
        duration: 300,
        ease: 'outQuad',
        onUpdate: (anim) => {
          setDisplayValue(anim.targets[0]?.value ?? end)
        },
      },
    )
    timeline.play()
    startRef.current = end
  }, [value, timeline])

  const clampedValue = Math.min(Math.max(displayValue, 0), max)
  const percent = max === 0 ? 0 : Math.min(Math.max((clampedValue / max) * 100, 0), 100)
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
      <text fg={barColor}>{'█'.repeat(filled)}{'░'.repeat(empty)}</text>
      {showPercent && <text fg={theme.muted}>{percent.toFixed(0)}%</text>}
    </box>
  )
}

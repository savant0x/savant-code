import React, { useEffect, useState } from 'react'
import { useTheme } from '../../../hooks/use-theme'

export interface PulseProps {
  color?: string
  label?: string
  interval?: number
}

export function Pulse({ color, label, interval = 800 }: PulseProps) {
  const theme = useTheme()
  const pulseColor = color ?? theme.primary
  const [on, setOn] = useState(true)

  useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), interval)
    return () => clearInterval(id)
  }, [interval])

  return (
    <text fg={on ? pulseColor : '#6b7280'}>
      {on ? '●' : '○'} {label ?? ''}
    </text>
  )
}

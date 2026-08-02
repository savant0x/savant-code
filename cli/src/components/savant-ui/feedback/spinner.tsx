import React, { useEffect, useState } from 'react'

import { useTheme } from '../../../hooks/use-theme'

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
  variant?: 'dots' | 'line'
}

const DOT_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const LINE_FRAMES = ['─', '\\', '│', '/']

export function Spinner({
  size = 'md',
  label,
  variant = 'dots',
}: SpinnerProps) {
  const theme = useTheme()
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const frames = variant === 'dots' ? DOT_FRAMES : LINE_FRAMES
    const interval = setInterval(
      () => {
        setFrame((f) => (f + 1) % frames.length)
      },
      size === 'sm' ? 60 : size === 'lg' ? 120 : 80,
    )
    return () => clearInterval(interval)
  }, [variant, size])

  const frames = variant === 'dots' ? DOT_FRAMES : LINE_FRAMES

  return (
    <text fg={theme.primary}>
      {frames[frame]} {label ?? ''}
    </text>
  )
}

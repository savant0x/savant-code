import React, { useEffect, useState } from 'react'

import { useTheme } from '../../../hooks/use-theme'

export interface TypewriterProps {
  text: string
  speed?: number
  onComplete?: () => void
  cursor?: boolean
}

export function Typewriter({
  text,
  speed = 30,
  onComplete,
  cursor = true,
}: TypewriterProps) {
  const theme = useTheme()
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (displayed.length >= text.length) {
      setDone(true)
      onComplete?.()
      return
    }
    const timeout = setTimeout(() => {
      setDisplayed(text.slice(0, displayed.length + 1))
    }, speed)
    return () => clearTimeout(timeout)
  }, [displayed, text, speed, onComplete])

  return (
    <text fg={theme.foreground}>
      {displayed}
      {cursor && !done && <text fg={theme.primary}>▌</text>}
    </text>
  )
}

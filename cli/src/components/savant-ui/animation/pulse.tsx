import React, { useEffect, useRef, useState } from 'react'

import { useAnimationBudget } from '../../../hooks/use-animation-budget'
import { useAnimationTimeline } from '../../../hooks/use-animation-timeline'
import { useTheme } from '../../../hooks/use-theme'

import type { TextRenderable } from '@opentui/core'

export interface PulseProps {
  color?: string
  label?: string
  interval?: number
}

export function Pulse({ color, label, interval = 800 }: PulseProps) {
  const theme = useTheme()
  const pulseColor = color ?? theme.primary
  const [on, setOn] = useState(true)
  const timeline = useAnimationTimeline({
    loop: true,
    duration: Number.POSITIVE_INFINITY,
  })
  const rootRef = useRef<TextRenderable | null>(null)
  const { isSuspended } = useAnimationBudget(rootRef)

  useEffect(() => {
    setOn(true)
    timeline.items.length = 0

    if (isSuspended) {
      // Scissor-hidden: pause so the engine drops the live loop.
      timeline.pause()
      return
    }

    timeline.add(
      { step: 0 },
      {
        step: 1,
        duration: interval,
        ease: 'linear',
        loop: true,
        onLoop: () => setOn((value) => !value),
      },
    )
    timeline.restart()

    return () => {
      timeline.pause()
    }
  }, [timeline, interval, isSuspended])

  return (
    <text ref={rootRef} fg={on ? pulseColor : theme.muted}>
      {on ? '●' : '○'} {label ?? ''}
    </text>
  )
}

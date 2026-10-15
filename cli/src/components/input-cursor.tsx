import { TextAttributes } from '@opentui/core'
import React, { useEffect, useState } from 'react'

import { useAnimationTimeline } from '../hooks/use-animation-timeline'

interface InputCursorProps {
  visible: boolean
  focused: boolean
  shouldBlink?: boolean
  char?: string
  color?: string
  blinkDelay?: number
  blinkInterval?: number
  bold?: boolean
}

export const InputCursor: React.FC<InputCursorProps> = ({
  visible,
  focused,
  shouldBlink = true,
  char = '▍',
  color,
  blinkDelay = 500,
  blinkInterval = 500,
  bold = true,
}) => {
  // false = normal/visible, true = invisible
  const [isInvisible, setIsInvisible] = useState(false)
  const timeline = useAnimationTimeline({
    loop: true,
    duration: Number.POSITIVE_INFINITY,
  })

  useEffect(() => {
    // Reset cursor to visible and clear any prior blink animation.
    setIsInvisible(false)
    timeline.items.length = 0

    if (shouldBlink && focused && visible) {
      // Idle delay = the animation's startTime; onLoop toggles visibility once
      // per cycle after that (the original idle-delay + blink-toggle behavior).
      timeline.add(
        { step: 0 },
        {
          step: 1,
          duration: blinkInterval,
          ease: 'linear',
          loop: true,
          onLoop: () => setIsInvisible((prev) => !prev),
        },
        blinkDelay,
      )
      timeline.restart()
    } else {
      timeline.pause()
    }

    return () => {
      timeline.pause()
    }
  }, [timeline, visible, focused, shouldBlink, blinkDelay, blinkInterval])

  if (!visible || !focused) {
    return null
  }

  // When invisible, return a space to maintain layout
  if (isInvisible) {
    return <span> </span>
  }

  return (
    <span
      {...(color ? { fg: color } : undefined)}
      {...(bold ? { attributes: TextAttributes.BOLD } : undefined)}
    >
      {char}
    </span>
  )
}

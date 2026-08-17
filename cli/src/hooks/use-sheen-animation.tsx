import React, { useCallback, useEffect, useState } from 'react'

import { useAnimationTimeline } from './use-animation-timeline'
import { SHADOW_CHARS, SHEEN_STEP, SHEEN_INTERVAL_MS } from '../login/constants'
import { getSheenColor } from '../login/utils'

interface UseSheenAnimationParams {
  enabled?: boolean
  logoColor: string
  accentColor: string
  blockColor: string
  terminalWidth: number | undefined
  sheenPosition: number
  setSheenPosition: (value: number | ((prev: number) => number)) => void
}

/**
 * Custom hook that handles the sheen animation effect on the logo
 * Animates a fill effect that loops: fill with accent color, then unfill back to original
 */
export function useSheenAnimation({
  enabled = true,
  logoColor,
  accentColor,
  blockColor,
  terminalWidth,
  sheenPosition,
  setSheenPosition,
}: UseSheenAnimationParams) {
  // Track whether we're in the reverse (unfill) phase
  const [isReversing, setIsReversing] = useState(false)
  const timeline = useAnimationTimeline({
    loop: true,
    duration: Number.POSITIVE_INFINITY,
  })

  // Run looping sheen animation (timeline-driven, FID-2026-0816-005).
  useEffect(() => {
    timeline.items.length = 0

    if (!enabled) {
      timeline.pause()
      return
    }

    const maxPosition = Math.max(10, Math.min((terminalWidth || 80) - 4, 100))
    const step = SHEEN_STEP
    // One cycle sweeps position 0 → maxPosition at the original cadence
    // (advance `step` every `SHEEN_INTERVAL_MS`).
    const duration = (maxPosition / step) * SHEEN_INTERVAL_MS

    timeline.add(
      { position: 0 },
      {
        position: maxPosition,
        duration,
        ease: 'linear',
        loop: true,
        onUpdate: (anim) => {
          const position = anim.targets[0]?.position ?? 0
          setSheenPosition(Math.floor(position / step) * step)
        },
        onLoop: () => setIsReversing((wasReversing) => !wasReversing),
      },
    )
    timeline.restart()

    return () => {
      timeline.pause()
    }
  }, [timeline, enabled, terminalWidth, setSheenPosition])

  // Apply sheen effect to a character based on its position
  const applySheenToChar = useCallback(
    (char: string, charIndex: number) => {
      if (char === ' ' || char === '\n') {
        return <span key={charIndex}>{char}</span>
      }

      const color = getSheenColor(
        char,
        charIndex,
        sheenPosition,
        logoColor,
        SHADOW_CHARS,
        accentColor,
        blockColor,
        isReversing,
      )

      return (
        <span key={charIndex} fg={color}>
          {char}
        </span>
      )
    },
    [sheenPosition, logoColor, accentColor, blockColor, isReversing],
  )

  return {
    applySheenToChar,
  }
}

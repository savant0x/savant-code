import { useEffect, useRef, useState } from 'react'

import {
  GLOW_CYCLE_MS,
  TRAFFIC_LIGHT_COLOR_KEYS,
  trafficLightFg,
} from './terminal-status-utils'
import { useAnimationBudget } from '../hooks/use-animation-budget'
import { useAnimationTimeline } from '../hooks/use-animation-timeline'
import { useTheme } from '../hooks/use-theme'

import type { TextRenderable } from '@opentui/core'

/**
 * Decorative traffic lights — green/yellow/red dots (right-aligned by the
 * caller's title bar) that breathe a subtle brightness glow
 * (FID-2026-0817-001). Driven by the Phase 2 timeline engine (zero
 * `setInterval`), staggered per dot, and suspended to static dots under the
 * animation budget (blur/scissor-hidden).
 */
export function TrafficLights() {
  const theme = useTheme()
  const [phase, setPhase] = useState(0)
  const timeline = useAnimationTimeline({
    loop: true,
    duration: Number.POSITIVE_INFINITY,
  })
  const rootRef = useRef<TextRenderable | null>(null)
  const { isSuspended } = useAnimationBudget(rootRef)

  useEffect(() => {
    setPhase(0)
    timeline.items.length = 0

    if (isSuspended) {
      timeline.pause()
      return
    }

    timeline.add(
      { phase: 0 },
      {
        phase: 1,
        duration: GLOW_CYCLE_MS,
        ease: 'linear',
        loop: true,
        onUpdate: (anim) => {
          setPhase(anim.targets[0]?.phase ?? 0)
        },
      },
    )
    timeline.restart()

    return () => {
      timeline.pause()
    }
  }, [timeline, isSuspended])

  const baseColors = TRAFFIC_LIGHT_COLOR_KEYS.map((key) => theme[key])

  return (
    <text ref={rootRef}>
      <span fg={trafficLightFg(0, phase, baseColors, isSuspended)}>●</span>
      <span> </span>
      <span fg={trafficLightFg(1, phase, baseColors, isSuspended)}>●</span>
      <span> </span>
      <span fg={trafficLightFg(2, phase, baseColors, isSuspended)}>●</span>
    </text>
  )
}

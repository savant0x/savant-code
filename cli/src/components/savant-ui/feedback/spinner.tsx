import React, { useEffect, useRef, useState } from 'react'

import { useAnimationBudget } from '../../../hooks/use-animation-budget'
import { useAnimationTimeline } from '../../../hooks/use-animation-timeline'
import { useTheme } from '../../../hooks/use-theme'

import type { TextRenderable } from '@opentui/core'

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
  const timeline = useAnimationTimeline({
    loop: true,
    duration: Number.POSITIVE_INFINITY,
  })
  const rootRef = useRef<TextRenderable | null>(null)
  const { throttleMs, isSuspended } = useAnimationBudget(rootRef)
  const lastCommitRef = useRef(0)
  const throttleMsRef = useRef(throttleMs)
  throttleMsRef.current = throttleMs

  const frames = variant === 'dots' ? DOT_FRAMES : LINE_FRAMES
  const frameInterval = size === 'sm' ? 60 : size === 'lg' ? 120 : 80

  useEffect(() => {
    setFrame(0)
    // Clear any previous looping item (frame count changes with variant).
    timeline.items.length = 0

    if (isSuspended) {
      // Scissor-hidden: pause so the engine drops the live loop.
      timeline.pause()
      return
    }

    timeline.add(
      { frame: 0 },
      {
        frame: frames.length,
        duration: frames.length * frameInterval,
        ease: 'linear',
        loop: true,
        onUpdate: (anim) => {
          const now = performance.now()
          if (now - lastCommitRef.current < throttleMsRef.current) return
          lastCommitRef.current = now
          setFrame(Math.floor(anim.targets[0]?.frame ?? 0) % frames.length)
        },
      },
    )
    timeline.restart()

    return () => {
      timeline.pause()
    }
  }, [timeline, frames, frameInterval, isSuspended])

  return (
    <text ref={rootRef} fg={theme.primary}>
      {frames[frame]} {label ?? ''}
    </text>
  )
}

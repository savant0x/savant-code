import { useCallback, useEffect, useRef, useState } from 'react'

import { useAnimationTimeline } from './use-animation-timeline'

import type { ChatMessage } from '../types/chat'
import type { ScrollBoxRenderable } from '@opentui/core'

// Scroll detection threshold - how close to bottom to consider "at bottom"
const SCROLL_NEAR_BOTTOM_THRESHOLD = 1

const DEFAULT_SCROLL_ANIMATION_DURATION_MS = 200

// Page scroll amount (fraction of viewport height)
const PAGE_SCROLL_FRACTION = 0.8

// Delay before auto-scrolling after content changes
const AUTO_SCROLL_DELAY_MS = 50

/**
 * Damped-spring interpolation for smooth scroll (FID-2026-0816-005 step 3).
 * Maps linear progress `t` (0..1) to a spring response with one gentle
 * overshoot, settling at exactly 1 by the end of the animation. `onComplete`
 * snaps to the exact target, so the tiny residual at t=1 is invisible.
 */
const springProgress = (t: number): number => {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const stiffness = 9 // settle speed
  const damping = 13 // oscillation frequency
  return 1 - Math.exp(-stiffness * t) * Math.cos(damping * t)
}

/**
 * Manages scroll behavior for the chat scrollbox with engine-driven smooth
 * animations (spring-interpolated `scrollTop`) and auto-scroll.
 *
 * @param scrollRef - Reference to the scrollbox component
 * @param messages - Array of chat messages (triggers auto-scroll on change)
 * @param isUserCollapsing - Callback to check if user is actively collapsing/expanding toggles.
 *                          When true, auto-scroll is temporarily suppressed to prevent jarring UX.
 * @returns Scroll management functions and state
 */
export const useChatScrollbox = (
  scrollRef: React.RefObject<ScrollBoxRenderable | null>,
  messages: ChatMessage[],
  isUserCollapsing: () => boolean,
) => {
  const autoScrollEnabledRef = useRef<boolean>(true)
  const programmaticScrollRef = useRef<boolean>(false)
  const timeline = useAnimationTimeline()
  const [isAtBottom, setIsAtBottom] = useState<boolean>(true)

  const cancelAnimation = useCallback(() => {
    timeline.items.length = 0
    timeline.pause()
  }, [timeline])

  const animateScrollTo = useCallback(
    (targetScroll: number, duration = DEFAULT_SCROLL_ANIMATION_DURATION_MS) => {
      const scrollbox = scrollRef.current
      if (!scrollbox) return

      cancelAnimation()

      const startScroll = scrollbox.scrollTop
      const distance = targetScroll - startScroll

      if (Math.abs(distance) < 0.5) {
        programmaticScrollRef.current = true
        scrollbox.scrollTop = targetScroll
        return
      }

      // Spring-interpolated `scrollTop` driven by the timeline engine. The
      // tween advances `t` 0 → 1 linearly; `springProgress` applies the damped
      // spring response, and `once` + `onComplete` finish the one-shot so the
      // engine drops the live loop when the scroll settles.
      timeline.add(
        { t: 0 },
        {
          t: 1,
          duration,
          ease: 'linear',
          once: true,
          onUpdate: (anim) => {
            const progress = anim.targets[0]?.t ?? 0
            programmaticScrollRef.current = true
            scrollbox.scrollTop =
              startScroll + distance * springProgress(progress)
          },
          onComplete: () => {
            programmaticScrollRef.current = true
            scrollbox.scrollTop = targetScroll
          },
        },
      )
      timeline.restart()
    },
    [scrollRef, cancelAnimation, timeline],
  )

  const scrollToLatest = useCallback((): void => {
    const scrollbox = scrollRef.current
    if (!scrollbox) return

    const maxScroll = Math.max(
      0,
      scrollbox.scrollHeight - scrollbox.viewport.height,
    )
    animateScrollTo(maxScroll)
  }, [scrollRef, animateScrollTo])

  const scrollUp = useCallback((): void => {
    const scrollbox = scrollRef.current
    if (!scrollbox) return

    const viewportHeight = scrollbox.viewport.height
    const scrollAmount = Math.floor(viewportHeight * PAGE_SCROLL_FRACTION)
    const targetScroll = Math.max(0, scrollbox.scrollTop - scrollAmount)
    animateScrollTo(targetScroll)
  }, [scrollRef, animateScrollTo])

  const scrollDown = useCallback((): void => {
    const scrollbox = scrollRef.current
    if (!scrollbox) return

    const viewportHeight = scrollbox.viewport.height
    const maxScroll = Math.max(0, scrollbox.scrollHeight - viewportHeight)
    const scrollAmount = Math.floor(viewportHeight * PAGE_SCROLL_FRACTION)
    const targetScroll = Math.min(maxScroll, scrollbox.scrollTop + scrollAmount)
    animateScrollTo(targetScroll)
  }, [scrollRef, animateScrollTo])

  useEffect(() => {
    const scrollbox = scrollRef.current
    if (!scrollbox) return

    const handleScrollChange = () => {
      const maxScroll = Math.max(
        0,
        scrollbox.scrollHeight - scrollbox.viewport.height,
      )
      const current = scrollbox.verticalScrollBar.scrollPosition
      const isNearBottom =
        Math.abs(maxScroll - current) <= SCROLL_NEAR_BOTTOM_THRESHOLD

      if (programmaticScrollRef.current) {
        programmaticScrollRef.current = false
        autoScrollEnabledRef.current = true
        setIsAtBottom(true)
        return
      }

      cancelAnimation()
      autoScrollEnabledRef.current = isNearBottom
      setIsAtBottom((prev) => (prev === isNearBottom ? prev : isNearBottom))
    }

    scrollbox.verticalScrollBar.on('change', handleScrollChange)

    return () => {
      scrollbox.verticalScrollBar.off('change', handleScrollChange)
    }
  }, [scrollRef, cancelAnimation])

  useEffect(() => {
    const scrollbox = scrollRef.current
    if (scrollbox) {
      const timeoutId = setTimeout(() => {
        const maxScroll = Math.max(
          0,
          scrollbox.scrollHeight - scrollbox.viewport.height,
        )

        if (scrollbox.scrollTop > maxScroll) {
          programmaticScrollRef.current = true
          scrollbox.scrollTop = maxScroll
        } else if (autoScrollEnabledRef.current && !isUserCollapsing()) {
          programmaticScrollRef.current = true
          scrollbox.scrollTop = maxScroll
        }
      }, AUTO_SCROLL_DELAY_MS)

      return () => clearTimeout(timeoutId)
    }
    return undefined
  }, [messages, scrollToLatest, scrollRef, isUserCollapsing])

  useEffect(() => {
    return () => {
      cancelAnimation()
    }
  }, [cancelAnimation])

  return {
    scrollToLatest,
    scrollUp,
    scrollDown,
    scrollboxProps: {},
    isAtBottom,
  }
}

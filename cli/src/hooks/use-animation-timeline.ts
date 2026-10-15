import { engine, Timeline } from '@opentui/core'
import { useEffect, useRef } from 'react'

export interface AnimationTimelineOptions {
  /**
   * Timeline-level loop. When `true` the timeline never marks itself complete
   * (its `currentTime` wraps instead of stopping). Looping components pass
   * `loop: true` together with an effectively unbounded `duration` so the
   * per-item `loop`/`onLoop` drives the cycle; the timeline's own default
   * `duration` (1000 ms) must NOT be allowed to halt the animation one second
   * in (FID-2026-0816-005 regression).
   */
  loop?: boolean
  /** Timeline-level duration in ms. Defaults to OpenTUI's 1000 ms. */
  duration?: number
}

/**
 * Stable, engine-registered timeline for continuous (looping) component
 * animations.
 *
 * `@opentui/react`'s `useTimeline` constructs a **new** `Timeline` on every
 * render but only registers the first one with the timeline engine, so a
 * looping animation that re-adds items on prop changes would target an
 * unregistered instance. This hook returns one stable instance for the
 * component's lifetime, registers it once, and unregisters it on unmount
 * (the engine's `updateLiveState` then calls `dropLive` when nothing is
 * playing — the FID-2026-0816-005 live-loop discipline).
 */
export function useAnimationTimeline(
  options: AnimationTimelineOptions = {},
): Timeline {
  const timelineRef = useRef<Timeline | null>(null)
  if (timelineRef.current === null) {
    timelineRef.current = new Timeline({
      autoplay: false,
      loop: options.loop === true,
      duration: options.duration,
    })
  }
  const timeline = timelineRef.current

  useEffect(() => {
    engine.register(timeline)
    return () => {
      timeline.pause()
      engine.unregister(timeline)
    }
  }, [timeline])

  return timeline
}

import { useEffect, useRef, useState } from 'react'

import { useAnimationTimeline } from './use-animation-timeline'

const DEFAULT_CHARS_PER_FLUSH = 16
const FLUSH_INTERVAL_MS = 24

/**
 * Streaming typewriter (FID-2026-0816-005 step 5).
 *
 * Reveals `fullText` progressively while `active` is true, committing React
 * state in ~`charsPerFlush` chunks (not per character) so the whole text tree
 * is not re-rendered on every streamed token. When `active` flips false the
 * full text is revealed immediately. Driven by the timeline engine (one-shot
 * catch-up tween), not a JS timer, and NOT the unshipped ScrollbackSurface
 * API.
 */
export function useTypewriter(
  fullText: string,
  active: boolean,
  charsPerFlush = DEFAULT_CHARS_PER_FLUSH,
): string {
  const [revealed, setRevealed] = useState<number>(() =>
    active ? 0 : fullText.length,
  )
  const revealedRef = useRef(revealed)
  // The catch-up tween can exceed the timeline's 1000 ms default for long
  // reveals, so give it an unbounded duration and pause it explicitly when the
  // one-shot completes (drops the live loop).
  const timeline = useAnimationTimeline({
    duration: Number.POSITIVE_INFINITY,
  })

  useEffect(() => {
    if (!active) {
      // Stream finished: reveal everything and stop.
      timeline.items.length = 0
      timeline.pause()
      revealedRef.current = fullText.length
      setRevealed(fullText.length)
      return
    }

    if (fullText.length === 0) {
      timeline.items.length = 0
      timeline.pause()
      revealedRef.current = 0
      setRevealed(0)
      return
    }

    const start = Math.min(revealedRef.current, fullText.length)
    if (start >= fullText.length) {
      return
    }

    const remaining = fullText.length - start
    const duration = Math.max(
      FLUSH_INTERVAL_MS,
      Math.ceil(remaining / charsPerFlush) * FLUSH_INTERVAL_MS,
    )

    timeline.items.length = 0
    timeline.add(
      { cursor: start },
      {
        cursor: fullText.length,
        duration,
        ease: 'linear',
        once: true,
        onUpdate: (anim) => {
          const cursor = anim.targets[0]?.cursor ?? fullText.length
          // Chunked commit: only flush state on ~charsPerFlush boundaries.
          const next = Math.min(
            fullText.length,
            Math.floor(cursor / charsPerFlush) * charsPerFlush,
          )
          if (next !== revealedRef.current) {
            revealedRef.current = next
            setRevealed(next)
          }
        },
        onComplete: () => {
          revealedRef.current = fullText.length
          setRevealed(fullText.length)
          timeline.pause()
        },
      },
    )
    timeline.restart()

    return () => {
      timeline.pause()
    }
  }, [active, fullText.length, timeline, charsPerFlush])

  return fullText.slice(0, revealed)
}

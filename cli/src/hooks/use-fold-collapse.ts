import { LayoutEvents } from '@opentui/core'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useAnimationTimeline } from './use-animation-timeline'

import type { BoxRenderable } from '@opentui/core'
import type { RefObject } from 'react'

const FOLD_DURATION_MS = 160

export interface FoldCollapse {
  /** Whether the body should be mounted in the tree. */
  mounted: boolean
  /** Current body height: `'auto'` when settled open, a number while tweening. */
  height: number | 'auto'
  /** Ref to attach to the foldable body box. */
  bodyRef: RefObject<BoxRenderable | null>
  /** Toggle open/closed (no-op while an animation is in flight). */
  toggle: () => void
  /** Whether the section is currently open (drives the chevron). */
  expanded: boolean
}

/**
 * Fold/collapse animation (FID-2026-0816-005 step 4).
 *
 * Folding tweens the body `height` to 0 with the timeline engine and only
 * unmounts on the tween's `onComplete`; unfolding mounts the body and tweens
 * 0 → its last-measured natural height. The natural height is recorded from
 * the body renderable whenever it lays out while settled, so a section that
 * was collapsed before its height was ever measured degrades to an instant
 * expand (the next fold animates correctly).
 */
export function useFoldCollapse(defaultExpanded = false): FoldCollapse {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [mounted, setMounted] = useState(defaultExpanded)
  const [height, setHeight] = useState<number | 'auto'>(
    defaultExpanded ? 'auto' : 0,
  )
  const bodyRef = useRef<BoxRenderable | null>(null)
  const naturalHeightRef = useRef(0)
  const animatingRef = useRef(false)
  const timeline = useAnimationTimeline()

  const runTween = useCallback(
    (from: number, to: number, onComplete: () => void) => {
      timeline.items.length = 0
      if (from === to) {
        onComplete()
        return
      }
      timeline.add(
        { h: from },
        {
          h: to,
          duration: FOLD_DURATION_MS,
          ease: 'inOutQuad',
          once: true,
          onUpdate: (anim) => {
            setHeight(Math.max(0, Math.round(anim.targets[0]?.h ?? to)))
          },
          onComplete,
        },
      )
      timeline.restart()
    },
    [timeline],
  )

  const collapse = useCallback(() => {
    const natural = bodyRef.current?.height ?? naturalHeightRef.current
    if (natural > 0) {
      naturalHeightRef.current = natural
    }
    setExpanded(false)
    animatingRef.current = true
    // Height tween to 0, then unmount on `onComplete`.
    runTween(naturalHeightRef.current, 0, () => {
      setMounted(false)
      animatingRef.current = false
    })
  }, [runTween])

  const expand = useCallback(() => {
    setExpanded(true)
    setMounted(true)
    const target = naturalHeightRef.current
    if (target <= 0) {
      // No measured height yet (section started collapsed): expand instantly.
      setHeight('auto')
      animatingRef.current = false
      return
    }
    setHeight(0)
    animatingRef.current = true
    runTween(0, target, () => {
      setHeight('auto')
      animatingRef.current = false
    })
  }, [runTween])

  const toggle = useCallback(() => {
    if (animatingRef.current) {
      return
    }
    if (expanded) {
      collapse()
    } else {
      expand()
    }
  }, [expanded, collapse, expand])

  // Record the natural height whenever the body lays out while settled.
  useEffect(() => {
    const body = bodyRef.current
    if (!body) {
      return undefined
    }
    const record = () => {
      if (!animatingRef.current && body.height > 0) {
        naturalHeightRef.current = body.height
      }
    }
    body.on(LayoutEvents.LAYOUT_CHANGED, record)
    body.on(LayoutEvents.RESIZED, record)
    return () => {
      body.off(LayoutEvents.LAYOUT_CHANGED, record)
      body.off(LayoutEvents.RESIZED, record)
    }
  }, [mounted])

  return { mounted, height, bodyRef, toggle, expanded }
}

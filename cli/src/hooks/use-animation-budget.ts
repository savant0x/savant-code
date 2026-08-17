import { LayoutEvents, ScrollBoxRenderable } from '@opentui/core'
import {
  useBlur,
  useFocus,
  useRenderer,
  useTerminalDimensions,
} from '@opentui/react'
import { useCallback, useEffect, useState } from 'react'

import type { Renderable } from '@opentui/core'
import type { RefObject } from 'react'

const FOCUSED_FPS = 60
const BLURRED_FPS = 15

interface Rect {
  left: number
  right: number
  top: number
  bottom: number
}

const rectOf = (renderable: Renderable): Rect => ({
  left: renderable.screenX,
  right: renderable.screenX + renderable.width,
  top: renderable.screenY,
  bottom: renderable.screenY + renderable.height,
})

const intersects = (a: Rect, b: Rect): boolean =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

/**
 * True when `node` is clipped out of view ("scissor-hidden"): an ancestor
 * ScrollBox scissor has moved it fully outside the viewport, any ancestor is
 * explicitly invisible or fully transparent, or it is laid out entirely
 * off-screen.
 */
function isScissorHidden(
  node: Renderable,
  terminalWidth: number,
  terminalHeight: number,
): boolean {
  const self = rectOf(node)

  for (
    let ancestor: Renderable | null = node;
    ancestor;
    ancestor = ancestor.parent
  ) {
    if (!ancestor.visible || ancestor.opacity === 0) {
      return true
    }
    if (ancestor instanceof ScrollBoxRenderable) {
      if (!intersects(self, rectOf(ancestor.viewport))) {
        return true
      }
    }
  }

  return !intersects(self, {
    left: 0,
    right: terminalWidth,
    top: 0,
    bottom: terminalHeight,
  })
}

export interface AnimationBudget {
  isFocused: boolean
  targetFps: number
  throttleMs: number
  isSuspended: boolean
}

/**
 * Central animation budget (FID-2026-0816-005 Phase 2).
 *
 * - `useBlur` → drop `targetFps` to 15 while the terminal window is blurred.
 * - Query layout bounds → suspend (`isSuspended`) when the owning renderable
 *   is scissor-hidden (clipped by an ancestor ScrollBox viewport, an invisible
 *   or fully-transparent ancestor, or laid out off-screen).
 * - `dropLive` in effect cleanup: while the animation is live the hook holds a
 *   `requestLive()` reference on the renderer and releases it with `dropLive()`
 *   when the animation suspends or unmounts, so a scissor-hidden or unmounted
 *   animation stops paying frames.
 *
 * Contract: pass `ref` pointing at the renderable that owns the animation so
 * the scissor query has layout bounds to inspect. Without a ref the budget
 * still throttles on blur but never suspends. The consumer is expected to
 * animate whenever `isSuspended === false` (it must pause its timeline on
 * suspension), so the live reference this hook holds tracks real animation
 * work.
 */
export function useAnimationBudget(
  ref?: RefObject<Renderable | null>,
): AnimationBudget {
  const [isFocused, setIsFocused] = useState(true)
  useFocus(() => setIsFocused(true))
  useBlur(() => setIsFocused(false))

  const renderer = useRenderer()
  const { width, height } = useTerminalDimensions()
  const [isSuspended, setIsSuspended] = useState(false)

  const recomputeSuspension = useCallback(() => {
    const node = ref?.current
    setIsSuspended(node ? isScissorHidden(node, width, height) : false)
  }, [ref, width, height])

  useEffect(() => {
    const node = ref?.current
    if (!node) {
      setIsSuspended(false)
      return undefined
    }

    // First layout is not committed when the effect runs; defer one tick.
    const timeoutId = setTimeout(recomputeSuspension, 0)

    // Re-evaluate when this renderable is laid out or resized.
    node.on(LayoutEvents.LAYOUT_CHANGED, recomputeSuspension)
    node.on(LayoutEvents.RESIZED, recomputeSuspension)

    // Re-evaluate when any ancestor ScrollBox scrolls (its scissor moves).
    const scrollAncestors: ScrollBoxRenderable[] = []
    for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
      if (ancestor instanceof ScrollBoxRenderable) {
        ancestor.verticalScrollBar.on('change', recomputeSuspension)
        ancestor.horizontalScrollBar.on('change', recomputeSuspension)
        scrollAncestors.push(ancestor)
      }
    }

    recomputeSuspension()

    return () => {
      clearTimeout(timeoutId)
      node.off(LayoutEvents.LAYOUT_CHANGED, recomputeSuspension)
      node.off(LayoutEvents.RESIZED, recomputeSuspension)
      for (const box of scrollAncestors) {
        box.verticalScrollBar.off('change', recomputeSuspension)
        box.horizontalScrollBar.off('change', recomputeSuspension)
      }
    }
  }, [ref, recomputeSuspension])

  // Hold a live reference while animating; drop it on suspension/unmount.
  useEffect(() => {
    if (isSuspended) {
      return undefined
    }
    renderer.requestLive()
    return () => renderer.dropLive()
  }, [isSuspended, renderer])

  const targetFps = isFocused ? FOCUSED_FPS : BLURRED_FPS
  const throttleMs = Math.round(1000 / targetFps)

  return { isFocused, targetFps, throttleMs, isSuspended }
}

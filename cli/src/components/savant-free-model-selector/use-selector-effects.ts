import { useEffect, useLayoutEffect } from 'react'

import type { ScrollBoxRenderable } from '@opentui/core'
import type React from 'react'

/**
 * Keep the focused element inside the viewport while arrowing through a
 * taller list; reset stale offsets when a resize makes everything fit.
 */
export function useSelectorScrollSync(opts: {
  scrollRef: React.MutableRefObject<ScrollBoxRenderable | null>
  focusedId: string
  contentHeight: number
  needsScroll: boolean
  extraTargetIds: readonly string[]
}): void {
  const { scrollRef, focusedId, contentHeight, needsScroll, extraTargetIds } =
    opts
  useLayoutEffect(() => {
    const sb = scrollRef.current
    if (!sb) return
    if (!needsScroll) {
      sb.scrollTop = 0
      return
    }
    sb.scrollChildIntoView(focusedId)
    // When the final referral action is focused, reveal the measured bottom.
    if (focusedId === extraTargetIds.at(-1)) {
      sb.scrollTop = Math.max(0, sb.scrollHeight - sb.viewport.height)
    }
  }, [focusedId, contentHeight, needsScroll, extraTargetIds])
}

/**
 * Keep focus valid as the list expands/collapses or the selection changes
 * server-side; only an out-of-range focus snaps back to the selection.
 */
export function useKeepSelectorFocusValid(opts: {
  navIds: readonly string[]
  selectedModel: string
  setFocusedId: React.Dispatch<React.SetStateAction<string>>
}): void {
  const { navIds, selectedModel, setFocusedId } = opts
  useEffect(() => {
    setFocusedId((curr) =>
      navIds.includes(curr)
        ? curr
        : navIds.includes(selectedModel)
          ? selectedModel
          : navIds[0]!,
    )
  }, [navIds, selectedModel])
}

import { useEffect, useRef } from 'react'

import { clamp } from '../../utils/math'

import type { FocusableScrollBox } from './types'
import type { ScrollBoxRenderable } from '@opentui/core'
import type { RefObject } from 'react'

/**
 * Owns the scrollbox ref and wires the focus/blur + auto-scroll-to-cursor
 * effects (FID-2026-0805-003). Extracted from multiline-input.tsx verbatim.
 */
export function useMultilineScrollbox(opts: {
  focused: boolean
  cursorPosition: number
  cursorRow: number
}): { scrollBoxRef: RefObject<ScrollBoxRenderable | null> } {
  const scrollBoxRef = useRef<ScrollBoxRenderable | null>(null)
  const prevFocusedRef = useRef(false)

  // Focus/blur scrollbox when focused prop changes
  useEffect(() => {
    if (opts.focused && !prevFocusedRef.current) {
      ;(scrollBoxRef.current as FocusableScrollBox | null)?.focus?.()
    } else if (!opts.focused && prevFocusedRef.current) {
      ;(scrollBoxRef.current as FocusableScrollBox | null)?.blur?.()
    }
    prevFocusedRef.current = opts.focused
  }, [opts.focused])

  // Auto-scroll to cursor when content changes
  useEffect(() => {
    const scrollBox = scrollBoxRef.current
    if (scrollBox && opts.focused) {
      const scrollPosition = clamp(
        scrollBox.verticalScrollBar.scrollPosition,
        Math.max(0, opts.cursorRow - scrollBox.viewport.height + 1),
        Math.min(
          scrollBox.scrollHeight - scrollBox.viewport.height,
          opts.cursorRow,
        ),
      )

      scrollBox.verticalScrollBar.scrollPosition = scrollPosition
    }
  }, [scrollBoxRef.current, opts.cursorPosition, opts.focused, opts.cursorRow])

  return { scrollBoxRef }
}

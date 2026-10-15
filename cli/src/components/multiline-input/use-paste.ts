import { useCallback, useEffect, useRef } from 'react'

import { getPasteText } from './text-utils'

import type { KeyHandler, PasteEvent } from '@opentui/core'

/**
 * Global + scrollbox paste handling with dedup (FID-2026-0805-003).
 * Extracted from multiline-input.tsx verbatim. Some terminals may not
 * deliver paste events reliably via one mechanism alone, so we listen at
 * both levels and dedup to prevent double-handling.
 */
export function usePasteHandling(opts: {
  keyHandler: KeyHandler | null | undefined
  onPaste: (fallbackText?: string) => void
}): { onScrollboxPaste: (event: PasteEvent) => void } {
  const onPasteRef = useRef(opts.onPaste)
  onPasteRef.current = opts.onPaste
  const pasteHandledRef = useRef(false)

  // Always listen for paste events regardless of terminal focus state.
  // Drag-and-drop inherently causes the terminal to lose focus (the file
  // manager has focus during the drag), so the paste listener must stay
  // active even when `focused` is false.
  useEffect(() => {
    const { keyHandler } = opts
    if (!keyHandler) return

    const handlePaste = (event: PasteEvent) => {
      pasteHandledRef.current = true
      onPasteRef.current(getPasteText(event))
      // Reset dedup flag after microtask so scrollbox handler (which fires
      // synchronously after global listeners) sees it as handled, but future
      // paste events are not blocked.
      queueMicrotask(() => {
        pasteHandledRef.current = false
      })
    }

    keyHandler.on('paste', handlePaste)
    return () => {
      keyHandler.off('paste', handlePaste)
    }
  }, [opts.keyHandler])

  const onScrollboxPaste = useCallback((event: PasteEvent) => {
    // Backup paste handler: fires if the global keyHandler listener
    // didn't catch this event (dedup prevents double-handling)
    if (pasteHandledRef.current) return
    onPasteRef.current(getPasteText(event))
  }, [])

  return { onScrollboxPaste }
}

import { TAB_WIDTH } from './text-utils'

import type { MouseDeps } from './types'

// Handle mouse clicks to position cursor
export function handleMouseKey(opts: MouseDeps): void {
  const {
    event,
    focused,
    value,
    cursorPosition,
    lineInfo,
    onChange,
    scrollBoxRef,
    resetStickyColumn,
    clearSelection,
  } = opts

  if (!focused) return

  // Clear sticky column since this is not up/down navigation
  resetStickyColumn()

  const scrollBox = scrollBoxRef.current
  if (!scrollBox) return

  const lineStarts = lineInfo?.lineStartCols ?? [0]

  const viewportTop = Number(scrollBox.viewport.y ?? 0)
  const viewportLeft = Number(scrollBox.viewport.x ?? 0)

  // Get click position, accounting for scroll
  const scrollPosition = scrollBox.verticalScrollBar?.scrollPosition ?? 0
  const clickRowInViewport = Math.floor(event.y - viewportTop)
  const clickRow = clickRowInViewport + scrollPosition

  // Find which visual line was clicked
  const lineIndex = Math.min(Math.max(0, clickRow), lineStarts.length - 1)

  // Get the character range for this line
  const lineStartChar = lineStarts[lineIndex]
  const lineEndChar = lineStarts[lineIndex + 1] ?? value.length

  // Convert click x to character position, accounting for tabs
  const clickCol = Math.max(0, Math.floor(event.x - viewportLeft))

  let visualCol = 0
  let charIndex = lineStartChar

  while (charIndex < lineEndChar && visualCol < clickCol) {
    const char = value[charIndex]
    if (char === '\t') {
      visualCol += TAB_WIDTH
    } else if (char === '\n') {
      break
    } else {
      visualCol += 1
    }
    charIndex++
  }

  // Clamp to valid range
  const newCursorPosition = Math.min(charIndex, value.length)

  // Update cursor position if changed
  if (newCursorPosition !== cursorPosition) {
    onChange({
      text: value,
      cursorPosition: newCursorPosition,
      lastEditDueToNav: false,
    })
  }

  // Suppress OpenTUI's native row selection/focus highlight when clicking
  // in the input box (FID-2026-0722-044).
  event.preventDefault?.()
  clearSelection()
}

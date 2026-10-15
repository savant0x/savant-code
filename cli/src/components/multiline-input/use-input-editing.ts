import { useCallback, useRef } from 'react'

import {
  clearRendererSelection,
  computeSelectionRange,
  handleSelectionDeletionImpl,
  insertTextAtCursorImpl,
} from './selection'

import type { SelectionRange, OnInputChange } from './types'
import type { CliRenderer, TextRenderable } from '@opentui/core'
import type { RefObject } from 'react'

/**
 * Stateful editing primitives for the multiline input (FID-2026-0805-003):
 * synchronous IME refs, selection helpers, insert-at-cursor, and move-cursor.
 */
export function useInputEditing(opts: {
  value: string
  cursorPosition: number
  onChange: OnInputChange
  textRef: RefObject<TextRenderable | null>
  renderer: CliRenderer | null
}): {
  getSelectionRange: () => SelectionRange | null
  clearSelection: () => void
  handleSelectionDeletion: () => boolean
  insertTextAtCursor: (text: string) => void
  moveCursor: (position: number) => void
} {
  const { value, cursorPosition, onChange, textRef, renderer } = opts

  // Refs to track latest value and cursor position synchronously for IME input handling.
  // When IME sends multiple character events rapidly (e.g., Chinese input), React batches
  // state updates, causing subsequent events to see stale closure values. These refs are
  // updated synchronously to ensure each keystroke builds on the previous one.
  const valueRef = useRef(value)
  const cursorPositionRef = useRef(cursorPosition)

  // Keep refs current on every render (synchronous assignment avoids useEffect timing issues)
  valueRef.current = value
  cursorPositionRef.current = cursorPosition

  // Helper to get current selection in original text coordinates
  const getSelectionRange = useCallback(
    () => computeSelectionRange({ value, textRef }),
    [value, textRef],
  )

  // Helper to clear the current selection
  const clearSelection = useCallback(
    () => clearRendererSelection(renderer),
    [renderer],
  )

  // Helper to handle selection deletion and call onChange if selection existed
  // Returns true if selection was deleted, false otherwise
  const handleSelectionDeletion = useCallback(
    () =>
      handleSelectionDeletionImpl({
        value,
        getSelectionRange,
        clearSelection,
        onChange,
      }),
    [value, getSelectionRange, clearSelection, onChange],
  )

  const insertTextAtCursor = useCallback(
    (textToInsert: string) =>
      insertTextAtCursorImpl({
        textToInsert,
        refs: { valueRef, cursorPositionRef },
        getSelectionRange,
        clearSelection,
        onChange,
      }),
    [getSelectionRange, clearSelection, onChange],
  )

  const moveCursor = useCallback(
    (nextPosition: number) => {
      const clamped = Math.max(0, Math.min(value.length, nextPosition))
      if (clamped === cursorPosition) return
      onChange({
        text: value,
        cursorPosition: clamped,
        lastEditDueToNav: false,
      })
    },
    [cursorPosition, onChange, value],
  )

  return {
    getSelectionRange,
    clearSelection,
    handleSelectionDeletion,
    insertTextAtCursor,
    moveCursor,
  }
}

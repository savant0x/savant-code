import { renderPositionToOriginal } from './text-utils'

import type {
  OnInputChange,
  SelectionRange,
  TextRenderableWithBuffer,
} from './types'
import type { CliRenderer, TextRenderable } from '@opentui/core'
import type { RefObject } from 'react'

// Helper to get current selection in original text coordinates
export function computeSelectionRange(opts: {
  value: string
  textRef: RefObject<TextRenderable | null>
}): SelectionRange | null {
  const { value, textRef } = opts
  const textBufferView = textRef.current
    ? (textRef.current as TextRenderableWithBuffer).textBufferView
    : null
  if (!textBufferView?.hasSelection?.() || !textBufferView?.getSelection) {
    return null
  }
  const selection = textBufferView.getSelection()
  if (!selection) return null

  // Convert from render positions to original text positions
  const start = renderPositionToOriginal(
    value,
    Math.min(selection.start, selection.end),
  )
  const end = renderPositionToOriginal(
    value,
    Math.max(selection.start, selection.end),
  )

  if (start === end) return null
  return { start, end }
}

// Helper to clear the current selection
export function clearRendererSelection(renderer: CliRenderer | null): void {
  // Use renderer's clearSelection for proper visual clearing
  renderer?.clearSelection?.()
}

// Helper to delete selected text and return new value and cursor position
export function deleteCurrentSelection(opts: {
  value: string
  getSelectionRange: () => SelectionRange | null
  clearSelection: () => void
}): { newValue: string; newCursor: number } | null {
  const { value, getSelectionRange, clearSelection } = opts
  const selection = getSelectionRange()
  if (!selection) return null

  const newValue = value.slice(0, selection.start) + value.slice(selection.end)
  clearSelection()
  return { newValue, newCursor: selection.start }
}

// Helper to handle selection deletion and call onChange if selection existed.
// Returns true if selection was deleted, false otherwise.
export function handleSelectionDeletionImpl(opts: {
  value: string
  getSelectionRange: () => SelectionRange | null
  clearSelection: () => void
  onChange: OnInputChange
}): boolean {
  const { value, getSelectionRange, clearSelection, onChange } = opts
  const deleted = deleteCurrentSelection({
    value,
    getSelectionRange,
    clearSelection,
  })
  if (deleted) {
    onChange({
      text: deleted.newValue,
      cursorPosition: deleted.newCursor,
      lastEditDueToNav: false,
    })
    return true
  }
  return false
}

export function insertTextAtCursorImpl(opts: {
  textToInsert: string
  onChange: OnInputChange
  getSelectionRange: () => SelectionRange | null
  clearSelection: () => void
  refs: {
    valueRef: RefObject<string>
    cursorPositionRef: RefObject<number>
  }
}): void {
  const { textToInsert, onChange, getSelectionRange, clearSelection, refs } =
    opts
  const { valueRef, cursorPositionRef } = refs

  if (!textToInsert) return

  // Check if there's a selection to replace
  const selection = getSelectionRange()
  if (selection) {
    // Replace selected text with the new text
    clearSelection()
    // Read from refs which have the latest values (updated synchronously below)
    const currentValue = valueRef.current
    const newValue =
      currentValue.slice(0, selection.start) +
      textToInsert +
      currentValue.slice(selection.end)
    const newCursor = selection.start + textToInsert.length

    // Update refs synchronously BEFORE calling onChange - critical for IME input
    // where multiple characters may arrive before React processes state updates
    valueRef.current = newValue
    cursorPositionRef.current = newCursor

    onChange({
      text: newValue,
      cursorPosition: newCursor,
      lastEditDueToNav: false,
    })
    return
  }

  // No selection, insert at cursor
  // Read from refs to get latest state (handles rapid IME input)
  const currentValue = valueRef.current
  const currentCursor = cursorPositionRef.current
  const newValue =
    currentValue.slice(0, currentCursor) +
    textToInsert +
    currentValue.slice(currentCursor)
  const newCursor = currentCursor + textToInsert.length

  // Update refs synchronously BEFORE calling onChange - critical for IME input
  // where multiple characters may arrive before React processes state updates
  valueRef.current = newValue
  cursorPositionRef.current = newCursor

  onChange({
    text: newValue,
    cursorPosition: newCursor,
    lastEditDueToNav: false,
  })
}

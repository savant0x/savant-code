import {
  getPrintableKeySequence,
  isAltModifier,
  preventKeyDefault,
} from './key-utils'
import {
  findLineEnd,
  findLineStart,
  findNextWordBoundary,
  findPreviousWordBoundary,
} from './text-utils'
import { calculateNewCursorPosition } from '../../utils/word-wrap-utils'

import type { CharacterKeyDeps, NavigationKeyDeps } from './types'

// Handle navigation keys (arrows, home, end, word navigation, emacs bindings)
export function handleNavigationKey(opts: NavigationKeyDeps): boolean {
  const {
    key,
    value,
    cursorPosition,
    onChange,
    moveCursor,
    shouldHighlight,
    getOrSetStickyColumn,
    getCurrentLineInfo,
  } = opts
  const lowerKeyName = (key.name ?? '').toLowerCase()
  const isAltLikeModifier = isAltModifier(key)
  const logicalLineStart = findLineStart(value, cursorPosition)
  const logicalLineEnd = findLineEnd(value, cursorPosition)
  const wordStart = findPreviousWordBoundary(value, cursorPosition)
  const wordEnd = findNextWordBoundary(value, cursorPosition) // Read lineInfo inside the callback to get current value (not stale from closure)
  const currentLineInfo = getCurrentLineInfo()

  // Calculate visual line boundaries from lineInfo (accounts for word wrap)
  // Fall back to logical line boundaries if visual info is unavailable
  const lineStarts = currentLineInfo?.lineStartCols ?? []
  const visualLineIndex = lineStarts.findLastIndex(
    (start) => start <= cursorPosition,
  )
  const visualLineStart =
    visualLineIndex >= 0 ? lineStarts[visualLineIndex] : logicalLineStart
  const visualLineEnd =
    lineStarts[visualLineIndex + 1] !== undefined
      ? lineStarts[visualLineIndex + 1] - 1
      : logicalLineEnd

  // Alt+Left/B: Word left
  if (isAltLikeModifier && (key.name === 'left' || lowerKeyName === 'b')) {
    preventKeyDefault(key)
    onChange({
      text: value,
      cursorPosition: wordStart,
      lastEditDueToNav: false,
    })
    return true
  }

  // Alt+Right/F: Word right
  if (isAltLikeModifier && (key.name === 'right' || lowerKeyName === 'f')) {
    preventKeyDefault(key)
    onChange({
      text: value,
      cursorPosition: wordEnd,
      lastEditDueToNav: false,
    })
    return true
  }

  // Cmd+Left, Ctrl+A, or Home: Line start
  if (
    (key.meta && key.name === 'left' && !isAltLikeModifier) ||
    (key.ctrl && lowerKeyName === 'a' && !key.meta && !key.option) ||
    (key.name === 'home' && !key.ctrl && !key.meta)
  ) {
    preventKeyDefault(key)
    onChange({
      text: value,
      cursorPosition: visualLineStart,
      lastEditDueToNav: false,
    })
    return true
  }

  // Cmd+Right, Ctrl+E, or End: Line end
  if (
    (key.meta && key.name === 'right' && !isAltLikeModifier) ||
    (key.ctrl && lowerKeyName === 'e' && !key.meta && !key.option) ||
    (key.name === 'end' && !key.ctrl && !key.meta)
  ) {
    preventKeyDefault(key)
    onChange({
      text: value,
      cursorPosition: visualLineEnd,
      lastEditDueToNav: false,
    })
    return true
  }

  // Cmd+Up or Ctrl+Home: Document start
  if ((key.meta && key.name === 'up') || (key.ctrl && key.name === 'home')) {
    preventKeyDefault(key)
    onChange({ text: value, cursorPosition: 0, lastEditDueToNav: false })
    return true
  }

  // Cmd+Down or Ctrl+End: Document end
  if ((key.meta && key.name === 'down') || (key.ctrl && key.name === 'end')) {
    preventKeyDefault(key)
    onChange({
      text: value,
      cursorPosition: value.length,
      lastEditDueToNav: false,
    })
    return true
  }

  // Ctrl+B: Backward char (Emacs)
  if (key.ctrl && lowerKeyName === 'b' && !key.meta && !key.option) {
    preventKeyDefault(key)
    onChange({
      text: value,
      cursorPosition: cursorPosition - 1,
      lastEditDueToNav: false,
    })
    return true
  }

  // Ctrl+F: Forward char (Emacs)
  if (key.ctrl && lowerKeyName === 'f' && !key.meta && !key.option) {
    preventKeyDefault(key)
    onChange({
      text: value,
      cursorPosition: Math.min(value.length, cursorPosition + 1),
      lastEditDueToNav: false,
    })
    return true
  }

  // Left arrow (no modifiers)
  if (key.name === 'left' && !key.ctrl && !key.meta && !key.option) {
    preventKeyDefault(key)
    moveCursor(cursorPosition - 1)
    return true
  }

  // Right arrow (no modifiers)
  if (key.name === 'right' && !key.ctrl && !key.meta && !key.option) {
    preventKeyDefault(key)
    moveCursor(cursorPosition + 1)
    return true
  }

  // Up arrow (no modifiers)
  if (key.name === 'up' && !key.ctrl && !key.meta && !key.option) {
    preventKeyDefault(key)
    const desiredIndex = getOrSetStickyColumn(lineStarts, !shouldHighlight)
    onChange({
      text: value,
      cursorPosition: calculateNewCursorPosition({
        cursorPosition,
        lineStarts,
        cursorIsChar: !shouldHighlight,
        direction: 'up',
        desiredIndex,
      }),
      lastEditDueToNav: false,
    })
    return true
  }

  // Down arrow (no modifiers)
  if (key.name === 'down' && !key.ctrl && !key.meta && !key.option) {
    preventKeyDefault(key)
    const desiredIndex = getOrSetStickyColumn(lineStarts, !shouldHighlight)
    onChange({
      text: value,
      cursorPosition: calculateNewCursorPosition({
        cursorPosition,
        lineStarts,
        cursorIsChar: !shouldHighlight,
        direction: 'down',
        desiredIndex,
      }),
      lastEditDueToNav: false,
    })
    return true
  }

  return false
}

// Handle character input (regular chars, tab, and IME/multi-byte input)
export function handleCharacterKey(opts: CharacterKeyDeps): boolean {
  const { key, insertTextAtCursor } = opts

  // Tab: let higher-level keyboard handlers (like chat keyboard shortcuts) handle it
  if (
    key.name === 'tab' &&
    key.sequence &&
    !key.shift &&
    !key.ctrl &&
    !key.meta &&
    !key.option
  ) {
    // Don't insert a literal tab character here; allow global keyboard handlers to process it
    return false
  }

  // Character input (including multi-byte characters from IME like Chinese, Japanese, Korean)
  const textToInsert = getPrintableKeySequence(key)
  if (textToInsert !== null) {
    preventKeyDefault(key)
    insertTextAtCursor(textToInsert)
    return true
  }

  return false
}

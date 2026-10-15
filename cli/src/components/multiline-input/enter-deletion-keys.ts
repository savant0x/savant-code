import { isAltModifier, preventKeyDefault } from './key-utils'
import {
  findLineEnd,
  findLineStart,
  findNextWordBoundary,
  findPreviousWordBoundary,
} from './text-utils'
import { isKeypadEnter } from '../../utils/keypad-keys'
import {
  isLinefeedActingAsEnter,
  markReturnKeySeenForKey,
} from '../../utils/terminal-enter-detection'

import type { DeletionKeyDeps, EnterKeyDeps } from './types'

// Handle enter/newline keys
export function handleEnterKey(opts: EnterKeyDeps): boolean {
  const { key, value, cursorPosition, onChange, onSubmit } = opts
  const lowerKeyName = (key.name ?? '').toLowerCase()
  const keypadEnter = isKeypadEnter(key)
  const isReturnOrEnter =
    key.name === 'return' || key.name === 'enter' || keypadEnter

  markReturnKeySeenForKey(key)

  const linefeedIsEnter =
    lowerKeyName === 'linefeed' && isLinefeedActingAsEnter()
  const isEnterKey = isReturnOrEnter || linefeedIsEnter

  const isCtrlJ =
    (lowerKeyName === 'linefeed' && !linefeedIsEnter) ||
    (key.ctrl && !key.meta && !key.option && lowerKeyName === 'j')

  // Only handle Enter and Ctrl+J here
  if (!isEnterKey && !isCtrlJ) return false

  const isAltLikeModifier = isAltModifier(key)
  // Kitty-protocol keyboards encode plain Enter as an escape sequence
  // (e.g. \x1b[13u) but report modifiers reliably, so the escape-prefix
  // and raw \r/\n heuristics (which exist to catch legacy Alt+Enter)
  // must not apply to kitty events.
  const isKittyKey = key.source === 'kitty'
  const hasEscapePrefix =
    !isKittyKey &&
    typeof key.sequence === 'string' &&
    key.sequence.length > 0 &&
    key.sequence.charCodeAt(0) === 0x1b
  const hasBackslashBeforeCursor =
    cursorPosition > 0 && value[cursorPosition - 1] === '\\'

  // Plain Enter: no modifiers, sequence is '\r' (macOS) or '\n' (Linux)
  const isPlainEnter =
    isEnterKey &&
    !key.shift &&
    !key.ctrl &&
    !key.meta &&
    !key.option &&
    !isAltLikeModifier &&
    (!hasEscapePrefix || keypadEnter) &&
    (key.sequence === '\r' ||
      key.sequence === '\n' ||
      keypadEnter ||
      isKittyKey) &&
    !hasBackslashBeforeCursor
  const isShiftEnter = isEnterKey && Boolean(key.shift)
  const isOptionEnter =
    isEnterKey && !keypadEnter && (isAltLikeModifier || hasEscapePrefix)
  const isBackslashEnter = isEnterKey && hasBackslashBeforeCursor

  const shouldInsertNewline =
    isCtrlJ || isShiftEnter || isOptionEnter || isBackslashEnter

  if (shouldInsertNewline) {
    preventKeyDefault(key)

    // For backslash+Enter, remove the backslash and insert newline
    if (isBackslashEnter) {
      const newValue =
        value.slice(0, cursorPosition - 1) + '\n' + value.slice(cursorPosition)
      onChange({
        text: newValue,
        cursorPosition,
        lastEditDueToNav: false,
      })
      return true
    }

    // For other newline shortcuts (Shift+Enter, Option+Enter, Ctrl+J), just insert newline
    const newValue =
      value.slice(0, cursorPosition) + '\n' + value.slice(cursorPosition)
    onChange({
      text: newValue,
      cursorPosition: cursorPosition + 1,
      lastEditDueToNav: false,
    })
    return true
  }

  if (isPlainEnter) {
    preventKeyDefault(key)
    onSubmit()
    return true
  }

  return false
}

// Handle deletion keys (backspace, delete, ctrl+h, ctrl+d, word/line deletion)
export function handleDeletionKey(opts: DeletionKeyDeps): boolean {
  const {
    key,
    value,
    cursorPosition,
    onChange,
    lineInfo,
    cursorRow,
    handleSelectionDeletion,
  } = opts
  const lowerKeyName = (key.name ?? '').toLowerCase()
  const isAltLikeModifier = isAltModifier(key)
  const lineStart = findLineStart(value, cursorPosition)
  const lineEnd = findLineEnd(value, cursorPosition)
  const wordStart = findPreviousWordBoundary(value, cursorPosition)
  const wordEnd = findNextWordBoundary(value, cursorPosition)

  // Ctrl+U: Delete from cursor to beginning of current VISUAL line
  if (key.ctrl && lowerKeyName === 'u' && !key.meta && !key.option) {
    preventKeyDefault(key)
    if (handleSelectionDeletion()) return true
    const visualLineStart = lineInfo?.lineStartCols?.[cursorRow] ?? lineStart

    if (cursorPosition > visualLineStart) {
      const newValue =
        value.slice(0, visualLineStart) + value.slice(cursorPosition)
      onChange({
        text: newValue,
        cursorPosition: visualLineStart,
        lastEditDueToNav: false,
      })
    } else if (cursorPosition > 0) {
      const newValue =
        value.slice(0, cursorPosition - 1) + value.slice(cursorPosition)
      onChange({
        text: newValue,
        cursorPosition: cursorPosition - 1,
        lastEditDueToNav: false,
      })
    }
    return true
  }

  // Alt+Backspace or Ctrl+W: Delete word backward
  if (
    (key.name === 'backspace' && isAltLikeModifier) ||
    (key.ctrl && lowerKeyName === 'w')
  ) {
    preventKeyDefault(key)
    if (handleSelectionDeletion()) return true
    const newValue = value.slice(0, wordStart) + value.slice(cursorPosition)
    onChange({
      text: newValue,
      cursorPosition: wordStart,
      lastEditDueToNav: false,
    })
    return true
  }

  // Cmd+Delete: Delete to line start
  if (key.name === 'delete' && key.meta && !isAltLikeModifier) {
    preventKeyDefault(key)
    if (handleSelectionDeletion()) return true
    const originalValue = value
    let newValue = originalValue
    let nextCursor = cursorPosition

    if (cursorPosition > 0) {
      if (cursorPosition === lineStart && value[cursorPosition - 1] === '\n') {
        newValue =
          value.slice(0, cursorPosition - 1) + value.slice(cursorPosition)
        nextCursor = cursorPosition - 1
      } else {
        newValue = value.slice(0, lineStart) + value.slice(cursorPosition)
        nextCursor = lineStart
      }
    }

    if (newValue === originalValue && cursorPosition > 0) {
      newValue =
        value.slice(0, cursorPosition - 1) + value.slice(cursorPosition)
      nextCursor = cursorPosition - 1
    }

    if (newValue !== originalValue) {
      onChange({
        text: newValue,
        cursorPosition: nextCursor,
        lastEditDueToNav: false,
      })
    }
    return true
  }

  // Alt+Delete: Delete word forward
  if (key.name === 'delete' && isAltLikeModifier) {
    preventKeyDefault(key)
    if (handleSelectionDeletion()) return true
    const newValue = value.slice(0, cursorPosition) + value.slice(wordEnd)
    onChange({
      text: newValue,
      cursorPosition,
      lastEditDueToNav: false,
    })
    return true
  }

  // Ctrl+K: Delete to line end
  if (key.ctrl && lowerKeyName === 'k' && !key.meta && !key.option) {
    preventKeyDefault(key)
    if (handleSelectionDeletion()) return true
    const newValue = value.slice(0, cursorPosition) + value.slice(lineEnd)
    onChange({ text: newValue, cursorPosition, lastEditDueToNav: false })
    return true
  }

  // Ctrl+H: Delete char backward (Emacs)
  if (key.ctrl && lowerKeyName === 'h' && !key.meta && !key.option) {
    preventKeyDefault(key)
    if (handleSelectionDeletion()) return true
    if (cursorPosition > 0) {
      const newValue =
        value.slice(0, cursorPosition - 1) + value.slice(cursorPosition)
      onChange({
        text: newValue,
        cursorPosition: cursorPosition - 1,
        lastEditDueToNav: false,
      })
    }
    return true
  }

  // Ctrl+D: Delete char forward (Emacs)
  if (key.ctrl && lowerKeyName === 'd' && !key.meta && !key.option) {
    preventKeyDefault(key)
    if (handleSelectionDeletion()) return true
    if (cursorPosition < value.length) {
      const newValue =
        value.slice(0, cursorPosition) + value.slice(cursorPosition + 1)
      onChange({
        text: newValue,
        cursorPosition,
        lastEditDueToNav: false,
      })
    }
    return true
  }

  // Basic Backspace (no modifiers)
  if (key.name === 'backspace' && !key.ctrl && !key.meta && !key.option) {
    preventKeyDefault(key)
    if (handleSelectionDeletion()) return true
    if (cursorPosition > 0) {
      const newValue =
        value.slice(0, cursorPosition - 1) + value.slice(cursorPosition)
      onChange({
        text: newValue,
        cursorPosition: cursorPosition - 1,
        lastEditDueToNav: false,
      })
    }
    return true
  }

  // Basic Delete (no modifiers)
  if (key.name === 'delete' && !key.ctrl && !key.meta && !key.option) {
    preventKeyDefault(key)
    if (handleSelectionDeletion()) return true
    if (cursorPosition < value.length) {
      const newValue =
        value.slice(0, cursorPosition) + value.slice(cursorPosition + 1)
      onChange({
        text: newValue,
        cursorPosition,
        lastEditDueToNav: false,
      })
    }
    return true
  }

  return false
}

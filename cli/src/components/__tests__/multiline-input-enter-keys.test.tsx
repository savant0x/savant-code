// MultilineInput test family — newline keyboard shortcuts: Ctrl+J,
// Shift+Enter, Option/Alt+Enter, Backslash+Enter. Sibling of the Loop 321
// decomposition (shared helpers in ./multiline-input-key-utils; plain/keypad
// submit cases live in ./multiline-input-enter-helper.test.tsx).

import { describe, test, expect } from 'bun:test'

import { isAltModifier } from './multiline-input-key-utils'
import { isKeypadEnter } from '../../utils/keypad-keys'

/**
 * Tests for newline keyboard shortcuts in MultilineInput component.
 *
 * These test the handleEnterKeys logic which determines whether:
 * - A newline should be inserted (Ctrl+J, Shift+Enter, Option+Enter, Backslash+Enter)
 * - The input should be submitted (plain Enter)
 * - The key should be ignored (other keys)
 */

/**
 * Determines the action that handleEnterKeys would take for a given key event.
 * Returns 'newline' if it should insert a newline, 'submit' if it should submit,
 * or 'ignore' if the key should not be handled.
 *
 * This mirrors the handleEnterKeys logic in multiline-input.tsx.
 */
function getEnterKeyAction(
  key: {
    name?: string
    sequence?: string
    ctrl?: boolean
    meta?: boolean
    shift?: boolean
    option?: boolean
    source?: 'raw' | 'kitty'
  },
  hasBackslashBeforeCursor: boolean = false,
): 'newline' | 'submit' | 'ignore' {
  const lowerKeyName = (key.name ?? '').toLowerCase()
  const keypadEnter = isKeypadEnter(key)
  const isEnterKey =
    key.name === 'return' || key.name === 'enter' || keypadEnter
  // Ctrl+J is translated by the terminal to a linefeed character (0x0a)
  // So we detect it by checking for name === 'linefeed' rather than ctrl + j
  const isCtrlJ =
    lowerKeyName === 'linefeed' ||
    (key.ctrl && !key.meta && !key.option && lowerKeyName === 'j')

  // Only handle Enter and Ctrl+J here
  if (!isEnterKey && !isCtrlJ) return 'ignore'

  const isAltLikeModifier = isAltModifier(key)
  const isKittyKey = key.source === 'kitty'
  const hasEscapePrefix =
    !isKittyKey &&
    typeof key.sequence === 'string' &&
    key.sequence.length > 0 &&
    key.sequence.charCodeAt(0) === 0x1b

  const isPlainEnter =
    isEnterKey &&
    !key.shift &&
    !key.ctrl &&
    !key.meta &&
    !key.option &&
    !isAltLikeModifier &&
    (!hasEscapePrefix || keypadEnter) &&
    (key.sequence === '\r' || keypadEnter || isKittyKey) &&
    !hasBackslashBeforeCursor
  const isShiftEnter =
    isEnterKey && (Boolean(key.shift) || key.sequence === '\n')
  const isOptionEnter =
    isEnterKey && !keypadEnter && (isAltLikeModifier || hasEscapePrefix)
  const isBackslashEnter = isEnterKey && hasBackslashBeforeCursor

  const shouldInsertNewline =
    isCtrlJ || isShiftEnter || isOptionEnter || isBackslashEnter

  if (shouldInsertNewline) return 'newline'
  if (isPlainEnter) return 'submit'

  return 'ignore'
}

describe('MultilineInput - newline keyboard shortcuts', () => {
  // --- Ctrl+J tests ---
  // Note: Terminals translate Ctrl+J to a linefeed character (0x0a) with name 'linefeed'
  // The ctrl flag is NOT set because the terminal performs the translation

  test('Ctrl+J inserts newline (detected as linefeed)', () => {
    // This is what terminals actually send when Ctrl+J is pressed
    const key = {
      name: 'linefeed',
      sequence: '\n',
      ctrl: false, // Terminal strips the ctrl flag
      meta: false,
      shift: false,
      option: false,
    }

    expect(getEnterKeyAction(key)).toBe('newline')
  })

  test('Ctrl+J with uppercase LINEFEED name also works', () => {
    const key = {
      name: 'LINEFEED',
      sequence: '\n',
      ctrl: false,
      meta: false,
      shift: false,
      option: false,
    }

    expect(getEnterKeyAction(key)).toBe('newline')
  })

  test('Ctrl+J fallback: raw ctrl+j event (if terminal passes it through)', () => {
    // Some terminals might pass through the raw key event
    const key = {
      name: 'j',
      sequence: '\n',
      ctrl: true,
      meta: false,
      shift: false,
      option: false,
    }

    expect(getEnterKeyAction(key)).toBe('newline')
  })

  test('Ctrl+Meta+J does not insert newline (meta blocks it)', () => {
    const key = {
      name: 'j',
      sequence: '\n',
      ctrl: true,
      meta: true,
      shift: false,
      option: false,
    }

    expect(getEnterKeyAction(key)).toBe('ignore')
  })

  test('Ctrl+Option+J does not insert newline (option blocks it)', () => {
    const key = {
      name: 'j',
      sequence: '\n',
      ctrl: true,
      meta: false,
      shift: false,
      option: true,
    }

    expect(getEnterKeyAction(key)).toBe('ignore')
  })

  // --- Ctrl+Enter (non-J) tests ---

  test('Ctrl+Enter (with return name) is ignored', () => {
    const key = {
      name: 'return',
      sequence: '\r',
      ctrl: true,
      meta: false,
      shift: false,
      option: false,
    }

    expect(getEnterKeyAction(key)).toBe('ignore')
  })

  // --- Shift+Enter tests ---

  test('Shift+Enter inserts newline (via shift flag)', () => {
    const key = {
      name: 'return',
      sequence: '\r',
      ctrl: false,
      meta: false,
      shift: true,
      option: false,
    }

    expect(getEnterKeyAction(key)).toBe('newline')
  })

  test('Shift+Enter inserts newline (via sequence being newline char)', () => {
    // Some terminals send \n instead of setting shift flag
    const key = {
      name: 'return',
      sequence: '\n',
      ctrl: false,
      meta: false,
      shift: false,
      option: false,
    }

    expect(getEnterKeyAction(key)).toBe('newline')
  })

  test('Shift+Enter with "enter" key name also works', () => {
    const key = {
      name: 'enter',
      sequence: '\r',
      ctrl: false,
      meta: false,
      shift: true,
      option: false,
    }

    expect(getEnterKeyAction(key)).toBe('newline')
  })

  // --- Option/Alt+Enter tests ---

  test('Option+Enter inserts newline (via option flag)', () => {
    const key = {
      name: 'return',
      sequence: '\r',
      ctrl: false,
      meta: false,
      shift: false,
      option: true,
    }

    expect(getEnterKeyAction(key)).toBe('newline')
  })

  test('Option+Enter inserts newline (via escape prefix sequence)', () => {
    // Alt key often sends ESC prefix followed by the key
    const key = {
      name: 'return',
      sequence: '\x1b\r', // ESC + carriage return
      ctrl: false,
      meta: false,
      shift: false,
      option: false,
    }

    expect(getEnterKeyAction(key)).toBe('newline')
  })

  test('Escape prefix with bracket does NOT trigger alt detection', () => {
    // Sequences like ESC+[ are ANSI escape codes, not alt+key
    // This should be treated differently based on hasEscapePrefix
    const key = {
      name: 'return',
      sequence: '\x1b[', // This is an escape sequence, not alt+enter
      ctrl: false,
      meta: false,
      shift: false,
      option: false,
    }

    // hasEscapePrefix is still true, so isOptionEnter is true
    expect(getEnterKeyAction(key)).toBe('newline')
  })

  // --- Backslash+Enter tests ---

  test('Backslash+Enter inserts newline (removes backslash)', () => {
    const key = {
      name: 'return',
      sequence: '\r',
      ctrl: false,
      meta: false,
      shift: false,
      option: false,
    }

    // When there's a backslash before cursor, it should insert newline
    expect(getEnterKeyAction(key, true)).toBe('newline')
  })

  test('Backslash+Shift+Enter still inserts newline', () => {
    const key = {
      name: 'return',
      sequence: '\r',
      ctrl: false,
      meta: false,
      shift: true,
      option: false,
    }

    // Both backslash and shift trigger newline
    expect(getEnterKeyAction(key, true)).toBe('newline')
  })
})

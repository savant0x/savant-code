// MultilineInput test family — Kitty keyboard protocol handling, the
// isAltModifier helper, and plain/keypad Enter submit behavior. Sibling of
// the Loop 321 decomposition (shared helpers in ./multiline-input-key-utils;
// getEnterKeyAction harness lives in multiline-input-enter-keys.test.tsx).

import { describe, test, expect } from 'bun:test'

import { isAltModifier } from './multiline-input-key-utils'
import { isKeypadEnter } from '../../utils/keypad-keys'

// Mirror of the family's getEnterKeyAction harness (kept local so each
// suite file owns its harness; identical logic, see enter-keys file).
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
  const isCtrlJ =
    lowerKeyName === 'linefeed' ||
    (key.ctrl && !key.meta && !key.option && lowerKeyName === 'j')

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

describe('MultilineInput - Kitty keyboard protocol + non-Enter keys', () => {
  // Some terminals (e.g. VSCode-fork embedded terminals on Linux) encode a
  // plain Enter press as CSI u (\x1b[13u) once the kitty protocol is active.
  // The escape prefix must not be mistaken for Alt+Enter in that case.

  test('Kitty CSI-u plain Enter submits', () => {
    const key = {
      name: 'return',
      sequence: '\x1b[13u',
      ctrl: false,
      meta: false,
      shift: false,
      option: false,
      source: 'kitty' as const,
    }

    expect(getEnterKeyAction(key, false)).toBe('submit')
  })

  test('Kitty Shift+Enter inserts newline', () => {
    const key = {
      name: 'return',
      sequence: '\x1b[13;2u',
      ctrl: false,
      meta: false,
      shift: true,
      option: false,
      source: 'kitty' as const,
    }

    expect(getEnterKeyAction(key)).toBe('newline')
  })

  test('Kitty Alt+Enter inserts newline', () => {
    const key = {
      name: 'return',
      sequence: '\x1b[13;3u',
      ctrl: false,
      meta: true,
      shift: false,
      option: true,
      source: 'kitty' as const,
    }

    expect(getEnterKeyAction(key)).toBe('newline')
  })

  test('Kitty plain Enter with backslash before cursor inserts newline', () => {
    const key = {
      name: 'return',
      sequence: '\x1b[13u',
      ctrl: false,
      meta: false,
      shift: false,
      option: false,
      source: 'kitty' as const,
    }

    expect(getEnterKeyAction(key, true)).toBe('newline')
  })

  // --- Plain Enter submit tests ---

  test('Plain Enter submits', () => {
    const key = {
      name: 'return',
      sequence: '\r',
      ctrl: false,
      meta: false,
      shift: false,
      option: false,
    }

    expect(getEnterKeyAction(key, false)).toBe('submit')
  })

  test('Plain Enter with "enter" key name submits', () => {
    const key = {
      name: 'enter',
      sequence: '\r',
      ctrl: false,
      meta: false,
      shift: false,
      option: false,
    }

    expect(getEnterKeyAction(key, false)).toBe('submit')
  })

  test('keypad Enter submits with Kitty keyboard key name', () => {
    const key = {
      name: 'kpenter',
      sequence: '\x1b[57414u',
      ctrl: false,
      meta: false,
      shift: false,
      option: false,
    }

    expect(getEnterKeyAction(key, false)).toBe('submit')
  })

  test('keypad Enter submits with raw application keypad sequence', () => {
    const key = {
      name: '',
      sequence: '\x1bOM',
      ctrl: false,
      meta: false,
      shift: false,
      option: false,
    }

    expect(getEnterKeyAction(key, false)).toBe('submit')
  })

  // --- Non-Enter key tests ---

  test('Regular J key (no ctrl) is ignored', () => {
    const key = {
      name: 'j',
      sequence: 'j',
      ctrl: false,
      meta: false,
      shift: false,
      option: false,
    }

    expect(getEnterKeyAction(key)).toBe('ignore')
  })

  test('Arrow key is ignored', () => {
    const key = {
      name: 'up',
      sequence: '\x1b[A',
      ctrl: false,
      meta: false,
      shift: false,
      option: false,
    }

    expect(getEnterKeyAction(key)).toBe('ignore')
  })

  test('Backspace is ignored', () => {
    const key = {
      name: 'backspace',
      sequence: '\x7f',
      ctrl: false,
      meta: false,
      shift: false,
      option: false,
    }

    expect(getEnterKeyAction(key)).toBe('ignore')
  })

  test('Tab is ignored', () => {
    const key = {
      name: 'tab',
      sequence: '\t',
      ctrl: false,
      meta: false,
      shift: false,
      option: false,
    }

    expect(getEnterKeyAction(key)).toBe('ignore')
  })

  // --- isAltModifier helper tests ---

  test('isAltModifier returns true when option flag is set', () => {
    expect(isAltModifier({ option: true, sequence: '\r' })).toBe(true)
  })

  test('isAltModifier returns true for ESC+char sequence (alt key)', () => {
    // Alt+a typically sends ESC followed by 'a'
    expect(isAltModifier({ option: false, sequence: '\x1ba' })).toBe(true)
  })

  test('isAltModifier returns false for ESC+[ sequence (ANSI escape)', () => {
    // ESC+[ is an ANSI escape code prefix, not alt+[
    expect(isAltModifier({ option: false, sequence: '\x1b[' })).toBe(false)
  })

  test('isAltModifier returns false for plain sequence', () => {
    expect(isAltModifier({ option: false, sequence: 'a' })).toBe(false)
  })

  test('isAltModifier returns false for empty sequence', () => {
    expect(isAltModifier({ option: false, sequence: '' })).toBe(false)
  })

  test('isAltModifier returns false for undefined sequence', () => {
    expect(isAltModifier({ option: false })).toBe(false)
  })
})

import { getKeypadPrintableSequence } from '../../utils/keypad-keys'

import type { KeyEvent } from '@opentui/core'

export const CURSOR_CHAR = '▍'
const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000b-\u000c\u000e-\u001f\u007f]/

/**
 * Check if a key event represents printable character input (not a special key).
 * Uses a positive heuristic based on key.name length rather than a brittle deny-list.
 *
 * The key insight is that OpenTUI's parser assigns descriptive multi-character names
 * to special keys (like 'backspace', 'up', 'f1') while regular printable characters
 * either have no name (multi-byte input like Chinese) or a single-character name.
 */
export function isPrintableCharacterKey(key: KeyEvent): boolean {
  const name = key.name

  // No name = likely multi-byte input (Chinese, Japanese, Korean, etc.) - treat as printable
  if (!name) return true

  // Single character name = regular ASCII printable (a, b, 1, $, etc.)
  if (name.length === 1) return true

  // Special case: space key has name 'space' but is printable
  if (name === 'space') return true

  // Multi-char name = special key (up, f1, backspace, etc.)
  return false
}

export function getPrintableKeySequence(key: KeyEvent): string | null {
  if (!key.sequence || key.sequence.length < 1) return null
  if (key.ctrl || key.meta || key.option) return null

  const keypadValue = getKeypadPrintableSequence(key)
  if (keypadValue !== null) return keypadValue

  if (!CONTROL_CHAR_REGEX.test(key.sequence) && isPrintableCharacterKey(key)) {
    return key.sequence
  }

  return null
}

type KeyWithPreventDefault =
  | {
      preventDefault?: () => void
    }
  | null
  | undefined

export function preventKeyDefault(key: KeyWithPreventDefault) {
  key?.preventDefault?.()
}

// Helper to check for alt-like modifier keys
export function isAltModifier(key: KeyEvent): boolean {
  const ESC = '\x1b'
  return Boolean(
    key.option ||
    (key.sequence?.length === 2 &&
      key.sequence[0] === ESC &&
      key.sequence[1] !== '['),
  )
}

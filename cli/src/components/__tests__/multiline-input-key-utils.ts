// Shared key-classification harness for the MultilineInput test family
// (see multiline-input-tab.test.tsx for the family header). These helpers
// mirror the module-scope logic of multiline-input.tsx so the keyboard
// suites can exercise the acceptance rules without mounting the component.

import { getKeypadPrintableSequence } from '../../utils/keypad-keys'

/**
 * Check if a key event represents printable character input (not a special key).
 * This mirrors the function in multiline-input.tsx for testing.
 *
 * Uses a positive heuristic based on key.name length rather than a brittle deny-list.
 * Special keys have descriptive multi-character names (like 'backspace', 'up', 'f1')
 * while regular printable characters either have no name or a single-character name.
 */
export function isPrintableCharacterKey(key: { name?: string }): boolean {
  const name = key.name

  // No name = likely multi-byte input (Chinese, Japanese, Korean, etc.)
  if (!name) return true

  // Single character name = regular ASCII printable (a, b, 1, $, etc.)
  if (name.length === 1) return true

  // Special case: space key has name 'space' but is printable
  if (name === 'space') return true

  // Multi-char name = special key (up, f1, backspace, etc.)
  return false
}

/**
 * Control character regex - matches characters that should not be inserted.
 * This mirrors the constant in multiline-input.tsx for testing.
 */
export const CONTROL_CHAR_REGEX =
  /[\u0000-\u0008\u000b-\u000c\u000e-\u001f\u007f]/

export type KeyEventLike = {
  sequence?: string
  name?: string
  ctrl?: boolean
  meta?: boolean
  option?: boolean
}

/** Returns the printable sequence for a key event, or null if not printable. */
export function getPrintableKeySequence(key: KeyEventLike): string | null {
  // Must have a sequence with at least one character
  if (!key.sequence || key.sequence.length < 1) {
    return null
  }

  // No modifier keys allowed
  if (key.ctrl || key.meta || key.option) {
    return null
  }

  const keypadValue = getKeypadPrintableSequence(key)
  if (keypadValue !== null) {
    return keypadValue
  }

  // Must not be a control character
  if (CONTROL_CHAR_REGEX.test(key.sequence)) {
    return null
  }

  // Must be a printable character key (not a special key like arrows, function keys, etc.)
  if (!isPrintableCharacterKey(key)) {
    return null
  }

  return key.sequence
}

/** Returns true if the key event should result in text being inserted. */
export function shouldAcceptCharacterInput(key: KeyEventLike): boolean {
  return getPrintableKeySequence(key) !== null
}

/** Checks for alt-like modifier keys (mirrors isAltModifier in multiline-input.tsx). */
export function isAltModifier(key: {
  option?: boolean
  sequence?: string
}): boolean {
  const ESC = '\x1b'
  return Boolean(
    key.option ||
    (key.sequence?.length === 2 &&
      key.sequence[0] === ESC &&
      key.sequence[1] !== '['),
  )
}

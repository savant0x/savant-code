// Shared harness for the resolveChatKeyboardAction test family.
// Sibling of the Loop 334 decomposition (suite files all import these).

import {
  createDefaultChatKeyboardState,
  type ChatKeyboardState,
} from '../keyboard-actions'

import type { KeyEvent } from '@opentui/core'

export const createKey = (overrides: Partial<KeyEvent> = {}): KeyEvent =>
  ({
    name: '',
    sequence: '',
    ctrl: false,
    meta: false,
    shift: false,
    option: false,
    ...overrides,
  }) as KeyEvent

export const escapeKey = createKey({ name: 'escape' })
export const ctrlC = createKey({ name: 'c', ctrl: true })
export const upKey = createKey({ name: 'up' })
export const downKey = createKey({ name: 'down' })
export const tabKey = createKey({ name: 'tab' })
export const shiftTabKey = createKey({ name: 'tab', shift: true })
export const enterKey = createKey({ name: 'return' })
export const keypadEnterKey = createKey({
  name: 'kpenter',
  sequence: '\x1b[57414u',
})
export const rawApplicationKeypadEnterKey = createKey({ sequence: '\x1bOM' })
export const backspaceKey = createKey({ name: 'backspace' })

export const defaultState: ChatKeyboardState = createDefaultChatKeyboardState()

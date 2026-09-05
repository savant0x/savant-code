// resolveChatKeyboardAction — enter-key behavior, drive-mode Esc
// (FID-2026-0818-007), and the Ctrl+T toggle-all binding.
// Sibling of the Loop 334 decomposition (shared key fixtures in
// keyboard-actions-test-harness).

import { describe, test, expect } from 'bun:test'

import {
  resolveChatKeyboardAction,
  type ChatKeyboardState,
} from '../keyboard-actions'
import {
  createKey,
  ctrlC,
  defaultState,
  enterKey,
  escapeKey,
  keypadEnterKey,
  rawApplicationKeypadEnterKey,
} from './keyboard-actions-test-harness'

describe('resolveChatKeyboardAction', () => {
  describe('enter key behavior', () => {
    test('enter without active menu does nothing', () => {
      expect(resolveChatKeyboardAction(enterKey, defaultState)).toEqual({
        type: 'none',
      })
    })

    test('keypad enter without active menu does nothing', () => {
      expect(resolveChatKeyboardAction(keypadEnterKey, defaultState)).toEqual({
        type: 'none',
      })
    })

    test('raw application keypad enter without active menu does nothing', () => {
      expect(
        resolveChatKeyboardAction(rawApplicationKeypadEnterKey, defaultState),
      ).toEqual({
        type: 'none',
      })
    })

    test('keypad enter selects an active slash menu item', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        slashMenuActive: true,
        slashMatchesLength: 3,
      }
      expect(resolveChatKeyboardAction(keypadEnterKey, state)).toEqual({
        type: 'slash-menu-select',
      })
    })

    test('raw application keypad enter selects an active slash menu item', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        slashMenuActive: true,
        slashMatchesLength: 3,
      }
      expect(
        resolveChatKeyboardAction(rawApplicationKeypadEnterKey, state),
      ).toEqual({
        type: 'slash-menu-select',
      })
    })

    test('shift+enter does nothing even in menu', () => {
      const shiftEnter = createKey({ name: 'return', shift: true })
      const state: ChatKeyboardState = {
        ...defaultState,
        slashMenuActive: true,
        slashMatchesLength: 3,
      }
      expect(resolveChatKeyboardAction(shiftEnter, state)).toEqual({
        type: 'none',
      })
    })
  })

  describe('drive-mode Esc (FID-2026-0818-007)', () => {
    const driveState: ChatKeyboardState = {
      ...defaultState,
      driveMode: true,
      isStreaming: true,
    }

    test('Esc in drive mode routes to drive-interrupt (not interrupt-stream)', () => {
      expect(resolveChatKeyboardAction(escapeKey, driveState)).toEqual({
        type: 'drive-interrupt',
      })
    })

    test('Esc in drive mode with no stream still routes to drive-interrupt', () => {
      const state = {
        ...driveState,
        isStreaming: false,
        isWaitingForResponse: false,
      }
      expect(resolveChatKeyboardAction(escapeKey, state)).toEqual({
        type: 'drive-interrupt',
      })
    })

    test('Esc in drive mode wins over the generic input-mode escape', () => {
      const state = { ...driveState, inputMode: 'bash' as const }
      expect(resolveChatKeyboardAction(escapeKey, state)).toEqual({
        type: 'drive-interrupt',
      })
    })

    test('Esc without drive mode keeps the generic interrupt', () => {
      const state = { ...defaultState, isStreaming: true, driveMode: false }
      expect(resolveChatKeyboardAction(escapeKey, state)).toEqual({
        type: 'interrupt-stream',
      })
    })

    test('Ctrl+C in drive mode still clears input (not drive-interrupt)', () => {
      const state = { ...driveState, inputValue: 'text' }
      expect(resolveChatKeyboardAction(ctrlC, state)).toEqual({
        type: 'clear-input',
      })
    })
  })

  describe('toggle all (Ctrl+T)', () => {
    const ctrlT = createKey({ name: 't', ctrl: true })

    test('Ctrl+T triggers toggle-all', () => {
      expect(resolveChatKeyboardAction(ctrlT, defaultState)).toEqual({
        type: 'toggle-all',
      })
    })

    test('Ctrl+T works while streaming', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        isStreaming: true,
      }
      expect(resolveChatKeyboardAction(ctrlT, state)).toEqual({
        type: 'toggle-all',
      })
    })

    test('Ctrl+T works with text in input', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        inputValue: 'some text',
      }
      expect(resolveChatKeyboardAction(ctrlT, state)).toEqual({
        type: 'toggle-all',
      })
    })

    test('Ctrl+T works in bash mode', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        inputMode: 'bash',
      }
      expect(resolveChatKeyboardAction(ctrlT, state)).toEqual({
        type: 'toggle-all',
      })
    })

    test('Ctrl+T blocked in feedback mode', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        feedbackMode: true,
      }
      expect(resolveChatKeyboardAction(ctrlT, state)).toEqual({
        type: 'none',
      })
    })

    test('Ctrl+T blocked in outOfCredits mode', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        inputMode: 'outOfCredits',
      }
      expect(resolveChatKeyboardAction(ctrlT, state)).toEqual({
        type: 'none',
      })
    })
  })
})

// resolveChatKeyboardAction — overlays, escape priority, and feedback mode.
// Parent of the Loop 334 decomposition (menu navigation, history/overrides,
// and enter/drive/toggle suites live in sibling files; shared key fixtures
// in keyboard-actions-test-harness).

import { describe, test, expect } from 'bun:test'

import {
  resolveChatKeyboardAction,
  type ChatKeyboardState,
} from '../keyboard-actions'
import {
  backspaceKey,
  ctrlC,
  defaultState,
  downKey,
  enterKey,
  escapeKey,
  upKey,
} from './keyboard-actions-test-harness'

describe('resolveChatKeyboardAction', () => {
  describe('model picker overlay', () => {
    test('any key returns none when model picker is open', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        modelPickerOpen: true,
        slashMenuActive: true,
        slashMatchesLength: 5,
      }
      expect(resolveChatKeyboardAction(upKey, state)).toEqual({
        type: 'none',
      })
      expect(resolveChatKeyboardAction(downKey, state)).toEqual({
        type: 'none',
      })
      expect(resolveChatKeyboardAction(enterKey, state)).toEqual({
        type: 'none',
      })
      expect(resolveChatKeyboardAction(escapeKey, state)).toEqual({
        type: 'none',
      })
      expect(resolveChatKeyboardAction(ctrlC, state)).toEqual({
        type: 'none',
      })
    })
  })

  describe('escape key priority - THE BUG FIX', () => {
    test('escape in bash mode exits mode BEFORE interrupting stream', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        inputMode: 'bash',
        isStreaming: true,
      }
      expect(resolveChatKeyboardAction(escapeKey, state)).toEqual({
        type: 'exit-input-mode',
      })
    })

    test('escape in default mode with streaming interrupts stream', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        inputMode: 'default',
        isStreaming: true,
      }
      expect(resolveChatKeyboardAction(escapeKey, state)).toEqual({
        type: 'interrupt-stream',
      })
    })

    test('escape in usage mode exits mode', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        inputMode: 'usage',
      }
      expect(resolveChatKeyboardAction(escapeKey, state)).toEqual({
        type: 'exit-input-mode',
      })
    })
  })

  describe('feedback mode', () => {
    test('escape in feedback mode exits feedback', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        feedbackMode: true,
      }
      expect(resolveChatKeyboardAction(escapeKey, state)).toEqual({
        type: 'exit-feedback-mode',
      })
    })

    test('ctrl-c in feedback mode with empty input exits feedback', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        feedbackMode: true,
        inputValue: '',
      }
      expect(resolveChatKeyboardAction(ctrlC, state)).toEqual({
        type: 'exit-feedback-mode',
      })
    })

    test('ctrl-c in feedback mode with text clears input', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        feedbackMode: true,
        inputValue: 'some feedback',
      }
      expect(resolveChatKeyboardAction(ctrlC, state)).toEqual({
        type: 'clear-feedback-input',
      })
    })
  })

  describe('escape with input text', () => {
    test('escape with text does NOT clear input (better UX)', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        inputValue: 'hello world',
      }
      expect(resolveChatKeyboardAction(escapeKey, state)).toEqual({
        type: 'none',
      })
    })

    test('ctrl-c with text clears input', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        inputValue: 'hello world',
      }
      expect(resolveChatKeyboardAction(ctrlC, state)).toEqual({
        type: 'clear-input',
      })
    })
  })

  describe('backspace at position 0', () => {
    test('backspace at position 0 in bash mode exits mode', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        inputMode: 'bash',
        cursorPosition: 0,
        inputValue: '',
      }
      expect(resolveChatKeyboardAction(backspaceKey, state)).toEqual({
        type: 'backspace-exit-mode',
      })
    })

    test('backspace at position 0 in default mode does nothing', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        inputMode: 'default',
        cursorPosition: 0,
        inputValue: '',
      }
      expect(resolveChatKeyboardAction(backspaceKey, state)).toEqual({
        type: 'none',
      })
    })
  })

  describe('ctrl-c behavior', () => {
    test('ctrl-c while streaming interrupts', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        isStreaming: true,
      }
      expect(resolveChatKeyboardAction(ctrlC, state)).toEqual({
        type: 'interrupt-stream',
      })
    })

    test('ctrl-c with paused queue clears queue', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        queuePaused: true,
        queuedCount: 5,
      }
      expect(resolveChatKeyboardAction(ctrlC, state)).toEqual({
        type: 'clear-queue',
      })
    })

    test('ctrl-c when nextCtrlCWillExit exits app', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        nextCtrlCWillExit: true,
      }
      expect(resolveChatKeyboardAction(ctrlC, state)).toEqual({
        type: 'exit-app',
      })
    })

    test('ctrl-c normally shows exit warning', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
      }
      expect(resolveChatKeyboardAction(ctrlC, state)).toEqual({
        type: 'exit-app-warning',
      })
    })
  })
})

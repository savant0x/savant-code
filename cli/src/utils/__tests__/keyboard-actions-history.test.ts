// resolveChatKeyboardAction — history navigation (including fall-through
// overrides) and waiting-for-response interrupts.
// Sibling of the Loop 334 decomposition (shared key fixtures in
// keyboard-actions-test-harness).

import { describe, test, expect } from 'bun:test'

import {
  resolveChatKeyboardAction,
  type ChatKeyboardState,
} from '../keyboard-actions'
import {
  ctrlC,
  defaultState,
  downKey,
  escapeKey,
  upKey,
} from './keyboard-actions-test-harness'

describe('resolveChatKeyboardAction', () => {
  describe('history navigation', () => {
    test('up arrow navigates history when enabled', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        historyNavUpEnabled: true,
      }
      expect(resolveChatKeyboardAction(upKey, state)).toEqual({
        type: 'history-up',
      })
    })

    test('down arrow navigates history when enabled', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        historyNavDownEnabled: true,
      }
      expect(resolveChatKeyboardAction(downKey, state)).toEqual({
        type: 'history-down',
      })
    })

    test('up arrow disabled when not enabled', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        historyNavUpEnabled: false,
      }
      expect(resolveChatKeyboardAction(upKey, state)).toEqual({
        type: 'none',
      })
    })
  })

  describe('history navigation overrides menu navigation', () => {
    test('up arrow in slash menu falls through to history when historyNavUpEnabled', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        slashMenuActive: true,
        slashMatchesLength: 5,
        slashSelectedIndex: 2,
        historyNavUpEnabled: true,
      }
      expect(resolveChatKeyboardAction(upKey, state)).toEqual({
        type: 'history-up',
      })
    })

    test('down arrow in slash menu falls through to history when historyNavDownEnabled', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        slashMenuActive: true,
        slashMatchesLength: 5,
        slashSelectedIndex: 2,
        historyNavDownEnabled: true,
      }
      expect(resolveChatKeyboardAction(downKey, state)).toEqual({
        type: 'history-down',
      })
    })

    test('up arrow in mention menu falls through to history when historyNavUpEnabled', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        mentionMenuActive: true,
        totalMentionMatches: 5,
        agentSelectedIndex: 2,
        historyNavUpEnabled: true,
      }
      expect(resolveChatKeyboardAction(upKey, state)).toEqual({
        type: 'history-up',
      })
    })

    test('down arrow in mention menu falls through to history when historyNavDownEnabled', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        mentionMenuActive: true,
        totalMentionMatches: 5,
        agentSelectedIndex: 2,
        historyNavDownEnabled: true,
      }
      expect(resolveChatKeyboardAction(downKey, state)).toEqual({
        type: 'history-down',
      })
    })
  })

  describe('isWaitingForResponse', () => {
    test('escape while waiting for response interrupts', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        isWaitingForResponse: true,
      }
      expect(resolveChatKeyboardAction(escapeKey, state)).toEqual({
        type: 'interrupt-stream',
      })
    })

    test('ctrl-c while waiting for response interrupts', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        isWaitingForResponse: true,
      }
      expect(resolveChatKeyboardAction(ctrlC, state)).toEqual({
        type: 'interrupt-stream',
      })
    })
  })

  describe('whitespace-only input', () => {
    test('escape with whitespace-only input does not clear', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        inputValue: '   ',
      }
      expect(resolveChatKeyboardAction(escapeKey, state)).toEqual({
        type: 'none',
      })
    })
  })
})

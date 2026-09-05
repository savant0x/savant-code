// resolveChatKeyboardAction — slash and mention menu navigation.
// Sibling of the Loop 334 decomposition (shared key fixtures in
// keyboard-actions-test-harness).

import { describe, test, expect } from 'bun:test'

import {
  resolveChatKeyboardAction,
  type ChatKeyboardState,
} from '../keyboard-actions'
import {
  createKey,
  defaultState,
  downKey,
  enterKey,
  escapeKey,
  shiftTabKey,
  tabKey,
  upKey,
} from './keyboard-actions-test-harness'

describe('resolveChatKeyboardAction', () => {
  describe('slash menu navigation', () => {
    const slashMenuState: ChatKeyboardState = {
      ...defaultState,
      slashMenuActive: true,
      slashMatchesLength: 5,
      slashSelectedIndex: 2,
    }

    test('down arrow moves selection down', () => {
      expect(resolveChatKeyboardAction(downKey, slashMenuState)).toEqual({
        type: 'slash-menu-down',
      })
    })

    test('down arrow at bottom does nothing', () => {
      const state = { ...slashMenuState, slashSelectedIndex: 4 }
      expect(resolveChatKeyboardAction(downKey, state)).toEqual({
        type: 'none',
      })
    })

    test('up arrow moves selection up', () => {
      expect(resolveChatKeyboardAction(upKey, slashMenuState)).toEqual({
        type: 'slash-menu-up',
      })
    })

    test('up arrow at top does nothing', () => {
      const state = { ...slashMenuState, slashSelectedIndex: 0 }
      expect(resolveChatKeyboardAction(upKey, state)).toEqual({
        type: 'none',
      })
    })

    test('tab completes without executing (does not navigate)', () => {
      expect(resolveChatKeyboardAction(tabKey, slashMenuState)).toEqual({
        type: 'slash-menu-complete',
      })
    })

    test('tab with single match completes without executing', () => {
      const state = { ...slashMenuState, slashMatchesLength: 1 }
      expect(resolveChatKeyboardAction(tabKey, state)).toEqual({
        type: 'slash-menu-complete',
      })
    })

    test('enter selects', () => {
      expect(resolveChatKeyboardAction(enterKey, slashMenuState)).toEqual({
        type: 'slash-menu-select',
      })
    })

    test('shift-tab completes without executing (does not navigate)', () => {
      expect(resolveChatKeyboardAction(shiftTabKey, slashMenuState)).toEqual({
        type: 'slash-menu-complete',
      })
    })

    test('menu disabled when disableSlashSuggestions is true', () => {
      const state = { ...slashMenuState, disableSlashSuggestions: true }
      expect(resolveChatKeyboardAction(downKey, state)).toEqual({
        type: 'none',
      })
    })
  })

  describe('mention menu navigation', () => {
    const mentionMenuState: ChatKeyboardState = {
      ...defaultState,
      mentionMenuActive: true,
      totalMentionMatches: 5,
      agentSelectedIndex: 2,
    }

    test('down arrow moves selection down', () => {
      expect(resolveChatKeyboardAction(downKey, mentionMenuState)).toEqual({
        type: 'mention-menu-down',
      })
    })

    test('enter selects', () => {
      expect(resolveChatKeyboardAction(enterKey, mentionMenuState)).toEqual({
        type: 'mention-menu-select',
      })
    })
  })

  describe('mention menu edge cases', () => {
    const mentionMenuState: ChatKeyboardState = {
      ...defaultState,
      mentionMenuActive: true,
      totalMentionMatches: 5,
      agentSelectedIndex: 2,
    }

    test('up arrow moves selection up', () => {
      expect(resolveChatKeyboardAction(upKey, mentionMenuState)).toEqual({
        type: 'mention-menu-up',
      })
    })

    test('up arrow at top does nothing', () => {
      const state = { ...mentionMenuState, agentSelectedIndex: 0 }
      expect(resolveChatKeyboardAction(upKey, state)).toEqual({
        type: 'none',
      })
    })

    test('down arrow at bottom does nothing', () => {
      const state = { ...mentionMenuState, agentSelectedIndex: 4 }
      expect(resolveChatKeyboardAction(downKey, state)).toEqual({
        type: 'none',
      })
    })

    test('tab with multiple matches cycles', () => {
      expect(resolveChatKeyboardAction(tabKey, mentionMenuState)).toEqual({
        type: 'mention-menu-tab',
      })
    })

    test('tab with single match completes without executing', () => {
      const state = { ...mentionMenuState, totalMentionMatches: 1 }
      expect(resolveChatKeyboardAction(tabKey, state)).toEqual({
        type: 'mention-menu-complete',
      })
    })

    test('shift-tab cycles backwards', () => {
      expect(resolveChatKeyboardAction(shiftTabKey, mentionMenuState)).toEqual({
        type: 'mention-menu-shift-tab',
      })
    })
  })

  describe('keys with modifiers are ignored for navigation', () => {
    test('ctrl+up does not navigate', () => {
      const ctrlUp = createKey({ name: 'up', ctrl: true })
      const state: ChatKeyboardState = {
        ...defaultState,
        historyNavUpEnabled: true,
      }
      expect(resolveChatKeyboardAction(ctrlUp, state)).toEqual({
        type: 'none',
      })
    })

    test('meta+down does not navigate', () => {
      const metaDown = createKey({ name: 'down', meta: true })
      const state: ChatKeyboardState = {
        ...defaultState,
        historyNavDownEnabled: true,
      }
      expect(resolveChatKeyboardAction(metaDown, state)).toEqual({
        type: 'none',
      })
    })

    test('option+up does not navigate slash menu', () => {
      const optionUp = createKey({ name: 'up', option: true })
      const state: ChatKeyboardState = {
        ...defaultState,
        slashMenuActive: true,
        slashMatchesLength: 5,
        slashSelectedIndex: 2,
      }
      expect(resolveChatKeyboardAction(optionUp, state)).toEqual({
        type: 'none',
      })
    })

    test('ctrl+tab does not open file menu', () => {
      const ctrlTab = createKey({ name: 'tab', ctrl: true })
      expect(resolveChatKeyboardAction(ctrlTab, defaultState)).toEqual({
        type: 'none',
      })
    })
  })

  describe('unfocus agent', () => {
    test('escape unfocuses agent when focused', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        focusedAgentId: 'agent-123',
      }
      expect(resolveChatKeyboardAction(escapeKey, state)).toEqual({
        type: 'unfocus-agent',
      })
    })
  })

  describe('tab opens file menu', () => {
    test('tab opens file menu when no menus active', () => {
      expect(resolveChatKeyboardAction(tabKey, defaultState)).toEqual({
        type: 'open-file-menu-with-tab',
      })
    })

    test('tab toggles agent mode when disableSlashSuggestions is true', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        disableSlashSuggestions: true,
      }
      expect(resolveChatKeyboardAction(tabKey, state)).toEqual({
        type: 'toggle-agent-mode',
      })
    })
  })

  describe('agent mode toggle', () => {
    test('shift-tab toggles agent mode when not in menus', () => {
      expect(resolveChatKeyboardAction(shiftTabKey, defaultState)).toEqual({
        type: 'toggle-agent-mode',
      })
    })

    test('shift-tab in slash menu completes, not agent mode toggle', () => {
      const state: ChatKeyboardState = {
        ...defaultState,
        slashMenuActive: true,
        slashMatchesLength: 3,
      }
      expect(resolveChatKeyboardAction(shiftTabKey, state)).toEqual({
        type: 'slash-menu-complete',
      })
    })
  })
})

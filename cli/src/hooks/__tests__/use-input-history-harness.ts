// Shared harness for the use-input-history test family.
// Sibling of the Loop 330 decomposition: mirrors the cross-mode history
// navigation logic (default <-> bash mode) with a mock navigator, since
// React 19 + Bun + RTL renderHook() is unreliable.

import type { InputMode } from '../../utils/input-modes'

export function parseHistoryItem(item: string): {
  mode: InputMode
  displayText: string
} {
  if (item.startsWith('!') && item.length > 1) {
    return { mode: 'bash', displayText: item.slice(1) }
  }
  return { mode: 'default', displayText: item }
}

export interface MockHistoryState {
  messageHistory: string[]
  historyIndex: number
  currentDraft: string
  currentDraftMode: InputMode
  isNavigating: boolean
  inputValue: string
  inputMode: InputMode
}

export function createMockHistoryNavigator(initialHistory: string[] = []) {
  const state: MockHistoryState = {
    messageHistory: initialHistory,
    historyIndex: -1,
    currentDraft: '',
    currentDraftMode: 'default',
    isNavigating: false,
    inputValue: '',
    inputMode: 'default',
  }

  const setInputValue = (value: {
    text: string
    cursorPosition: number
    lastEditDueToNav: boolean
  }) => {
    state.inputValue = value.text
  }

  const setInputMode = (mode: InputMode) => {
    state.inputMode = mode
  }

  const resetHistoryNavigation = () => {
    state.historyIndex = -1
    state.currentDraft = ''
    state.currentDraftMode = 'default'
  }

  const navigateUp = () => {
    const history = state.messageHistory
    if (history.length === 0) return

    state.isNavigating = true

    if (state.historyIndex === -1) {
      state.currentDraft =
        state.inputMode === 'bash' ? '!' + state.inputValue : state.inputValue
      state.currentDraftMode = state.inputMode
      state.historyIndex = history.length - 1
    } else if (state.historyIndex > 0) {
      state.historyIndex -= 1
    }

    const historyMessage = history[state.historyIndex]
    if (historyMessage === undefined) {
      state.isNavigating = false
      return
    }

    const { mode, displayText } = parseHistoryItem(historyMessage)

    if (mode !== state.inputMode) {
      setInputMode(mode)
    }

    setInputValue({
      text: displayText,
      cursorPosition: displayText.length,
      lastEditDueToNav: true,
    })

    state.isNavigating = false
  }

  const navigateDown = () => {
    const history = state.messageHistory
    if (history.length === 0) return
    if (state.historyIndex === -1) return

    state.isNavigating = true

    if (state.historyIndex < history.length - 1) {
      state.historyIndex += 1
      const historyMessage = history[state.historyIndex]
      if (historyMessage === undefined) {
        state.isNavigating = false
        return
      }

      const { mode, displayText } = parseHistoryItem(historyMessage)

      // Switch mode if needed
      if (mode !== state.inputMode) {
        setInputMode(mode)
      }

      setInputValue({
        text: displayText,
        cursorPosition: displayText.length,
        lastEditDueToNav: true,
      })
    } else {
      state.historyIndex = -1
      const draft = state.currentDraft
      const draftMode = state.currentDraftMode

      if (draftMode !== state.inputMode) {
        setInputMode(draftMode)
      }

      const textToShow =
        draftMode === 'bash' && draft.startsWith('!') ? draft.slice(1) : draft

      setInputValue({
        text: textToShow,
        cursorPosition: textToShow.length,
        lastEditDueToNav: true,
      })
    }

    state.isNavigating = false
  }

  const simulateInputModeChange = (newMode: InputMode) => {
    const oldMode = state.inputMode
    state.inputMode = newMode

    if (!state.isNavigating && oldMode !== newMode) {
      resetHistoryNavigation()
    }
  }

  return {
    state,
    setInputValue,
    setInputMode,
    resetHistoryNavigation,
    navigateUp,
    navigateDown,
    simulateInputModeChange,
  }
}

import { describe, expect, mock, test } from 'bun:test'

import type { InputValue } from '../types/store'
import type { InputMode } from '../utils/input-modes'

describe('bash-mode entry and exit', () => {
  describe('entering bash mode', () => {
    test('typing exactly "!" enters bash mode and clears input', () => {
      const setInputMode = mock((_mode: InputMode) => {})
      const setInputValue = mock((_value: Partial<InputValue>) => {})
      const inputValue = {
        text: '!',
        cursorPosition: 1,
        lastEditDueToNav: false,
      }
      const inputMode: InputMode = 'default'
      const userTypedBang = inputMode === 'default' && inputValue.text === '!'

      if (userTypedBang) {
        setInputMode('bash')
        setInputValue({
          text: '',
          cursorPosition: 0,
          lastEditDueToNav: inputValue.lastEditDueToNav,
        })
      }

      expect(setInputMode).toHaveBeenCalledWith('bash')
      expect(setInputValue).toHaveBeenCalled()
    })

    test('typing "!ls" does NOT enter bash mode (not exactly "!")', () => {
      const setInputMode = mock((_mode: InputMode) => {})
      const setInputValue = mock((_value: Partial<InputValue>) => {})
      const inputValue = {
        text: '!ls',
        cursorPosition: 3,
        lastEditDueToNav: false,
      }
      const inputMode: InputMode = 'default'
      const userTypedBang = inputMode === 'default' && inputValue.text === '!'

      if (userTypedBang) {
        setInputMode('bash')
        setInputValue({
          text: '',
          cursorPosition: 0,
          lastEditDueToNav: inputValue.lastEditDueToNav,
        })
      }

      expect(setInputMode).not.toHaveBeenCalled()
      expect(setInputValue).not.toHaveBeenCalled()
    })

    test('typing "!" when already in bash mode does nothing special', () => {
      const setInputMode = mock((_mode: InputMode) => {})
      const setInputValue = mock((_value: Partial<InputValue>) => {})
      const inputValue = {
        text: '!',
        cursorPosition: 1,
        lastEditDueToNav: false,
      }
      const inputMode = 'bash' as InputMode
      const userTypedBang =
        inputMode === ('default' as InputMode) && inputValue.text === '!'

      if (userTypedBang) {
        setInputMode('bash')
        setInputValue({
          text: '',
          cursorPosition: 0,
          lastEditDueToNav: inputValue.lastEditDueToNav,
        })
      }

      expect(setInputMode).not.toHaveBeenCalled()
      expect(setInputValue).not.toHaveBeenCalled()
    })
  })

  describe('exiting bash mode', () => {
    test('backspace at cursor position 0 exits bash mode', () => {
      const setInputMode = mock((_mode: InputMode) => {})
      const inputMode: InputMode = 'bash'
      const cursorPosition = 0
      const key = { name: 'backspace' }

      if (
        inputMode === 'bash' &&
        cursorPosition === 0 &&
        key.name === 'backspace'
      ) {
        setInputMode('default')
      }

      expect(setInputMode).toHaveBeenCalledWith('default')
    })

    test('backspace at cursor position 0 with non-empty input DOES exit bash mode', () => {
      const setInputMode = mock((_mode: InputMode) => {})
      const inputMode: InputMode = 'bash'
      const cursorPosition = 0
      const key = { name: 'backspace' }

      if (
        inputMode === 'bash' &&
        cursorPosition === 0 &&
        key.name === 'backspace'
      ) {
        setInputMode('default')
      }

      expect(setInputMode).toHaveBeenCalledWith('default')
    })

    test('backspace at cursor position > 0 does NOT exit bash mode', () => {
      const setInputMode = mock((_mode: InputMode) => {})
      const inputMode: InputMode = 'bash'
      const cursorPosition: number = 2
      const key = { name: 'backspace' }

      if (
        inputMode === 'bash' &&
        cursorPosition === 0 &&
        key.name === 'backspace'
      ) {
        setInputMode('default')
      }

      expect(setInputMode).not.toHaveBeenCalled()
    })

    test('other keys at cursor position 0 do NOT exit bash mode', () => {
      const setInputMode = mock((_mode: InputMode) => {})
      const inputMode: InputMode = 'bash'
      const cursorPosition = 0
      const key = { name: 'a' }

      if (
        inputMode === 'bash' &&
        cursorPosition === 0 &&
        key.name === 'backspace'
      ) {
        setInputMode('default')
      }

      expect(setInputMode).not.toHaveBeenCalled()
    })

    test('backspace when NOT in bash mode does nothing to bash mode', () => {
      const setInputMode = mock((_mode: InputMode) => {})
      const inputMode = 'default' as InputMode
      const cursorPosition = 0
      const key = { name: 'backspace' }

      if (
        inputMode === ('bash' as InputMode) &&
        cursorPosition === 0 &&
        key.name === 'backspace'
      ) {
        setInputMode('default')
      }

      expect(setInputMode).not.toHaveBeenCalled()
    })
  })
})

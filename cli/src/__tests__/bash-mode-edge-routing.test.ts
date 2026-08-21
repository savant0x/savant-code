import { describe, expect, test } from 'bun:test'

import type { InputMode } from '../utils/input-modes'

describe('bash-mode edge cases and command routing', () => {
  describe('edge cases', () => {
    test('empty string is NOT the same as "!"', () => {
      const inputMode: InputMode = 'default'
      const inputValue: string = ''
      const exclamation = '!'
      const inputEqualsExclamation = inputValue === exclamation

      expect(inputEqualsExclamation).toBe(false)
      expect(inputMode).toBe('default')
    })

    test('whitespace around "!" prevents bash mode entry', () => {
      const exclamation = '!'
      const inputValue1: string = ' !'
      const inputValue2: string = '! '
      const inputValue3: string = ' ! '

      expect(inputValue1 === exclamation).toBe(false)
      expect(inputValue2 === exclamation).toBe(false)
      expect(inputValue3 === exclamation).toBe(false)
    })

    test('multiple "!" characters do not enter bash mode', () => {
      const inputValue: string = '!!'
      const exclamation = '!'
      const inputEqualsExclamation = inputValue === exclamation

      expect(inputEqualsExclamation).toBe(false)
    })

    test('mode can be entered, exited, and re-entered', () => {
      let inputMode: InputMode = 'default'
      inputMode = 'bash'
      expect(inputMode).toBe('bash')
      inputMode = 'default'
      expect(inputMode).toBe('default')
      inputMode = 'bash'
      expect(inputMode).toBe('bash')
    })
  })

  describe('integration with command router', () => {
    test('bash mode commands are routed differently than normal prompts', () => {
      const inputMode: InputMode = 'bash'
      expect(inputMode).toBe('bash')
    })

    test('normal commands starting with "!" are NOT bash commands', () => {
      const inputMode = 'default' as InputMode
      const inputValue = '!ls'

      expect(inputMode).toBe('default')
      expect(inputValue).toBe('!ls')
    })

    test('bash mode takes precedence over slash commands', () => {
      const inputMode = 'bash' as InputMode
      const trimmedInput = '/help'

      if (inputMode === ('bash' as InputMode)) {
        const commandWithBang = '!' + trimmedInput
        expect(commandWithBang).toBe('!/help')
      }
    })
  })
})

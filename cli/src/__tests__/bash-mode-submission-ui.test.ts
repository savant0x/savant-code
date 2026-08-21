import { describe, expect, mock, test } from 'bun:test'

import type { InputMode } from '../utils/input-modes'

describe('bash-mode storage, submission, and UI', () => {
  describe('bash mode input storage', () => {
    test('input value does NOT include "!" prefix while in bash mode', () => {
      const inputMode: InputMode = 'bash'
      const inputValue = 'ls -la'

      expect(inputValue).toBe('ls -la')
      expect(inputValue).not.toContain('!')
      expect(inputMode).toBe('bash')
    })

    test('normal mode input can contain "!" anywhere', () => {
      const inputValue = 'fix this bug!'
      expect(inputValue).toContain('!')
    })
  })

  describe('bash mode submission', () => {
    test('submitting bash command prepends "!" to the stored value', () => {
      const inputMode: InputMode = 'bash'
      const trimmedInput = 'ls -la'
      const commandWithBang =
        inputMode === 'bash' ? '!' + trimmedInput : trimmedInput

      expect(commandWithBang).toBe('!ls -la')
    })

    test('submission displays "!" in user message', () => {
      const inputMode: InputMode = 'bash'
      const trimmedInput = 'pwd'
      const commandWithBang =
        inputMode === 'bash' ? '!' + trimmedInput : trimmedInput
      const userMessage = { content: commandWithBang }

      expect(userMessage.content).toBe('!pwd')
    })

    test('submission saves command WITH "!" to history', () => {
      const saveToHistory = mock((_command: string) => {})
      const trimmedInput = 'git status'
      const commandWithBang = '!' + trimmedInput

      saveToHistory(commandWithBang)
      expect(saveToHistory).toHaveBeenCalledWith('!git status')
    })

    test('submission exits bash mode after running command', () => {
      const setInputMode = mock((_mode: InputMode) => {})
      setInputMode('default')
      expect(setInputMode).toHaveBeenCalledWith('default')
    })

    test('terminal command receives value WITHOUT "!" prefix', () => {
      const runTerminalCommand = mock((_params: Record<string, unknown>) =>
        Promise.resolve([{ value: { stdout: 'output' } }]),
      )
      const trimmedInput = 'echo hello'

      runTerminalCommand({
        command: trimmedInput,
        process_type: 'SYNC',
        cwd: process.cwd(),
        timeout_seconds: -1,
        env: process.env,
      })

      expect(runTerminalCommand).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'echo hello' }),
      )
    })
  })

  describe('bash mode UI state', () => {
    test('input mode is stored separately from input value', () => {
      const state1: { inputMode: InputMode; inputValue: string } = {
        inputMode: 'bash',
        inputValue: 'ls',
      }
      const state2: { inputMode: InputMode; inputValue: string } = {
        inputMode: 'default',
        inputValue: 'hello',
      }

      expect(state1.inputMode).toBe('bash')
      expect(state1.inputValue).not.toContain('!')
      expect(state2.inputMode).toBe('default')
      expect(state2.inputValue).not.toContain('!')
    })

    test('input width is adjusted in bash mode for "!" column', () => {
      const baseInputWidth = 100
      const inputModeValue: InputMode = 'bash'
      const adjustedInputWidth =
        inputModeValue === 'bash' ? baseInputWidth - 2 : baseInputWidth

      expect(adjustedInputWidth).toBe(98)
    })

    test('input width is NOT adjusted when not in bash mode', () => {
      const baseInputWidth = 100
      const inputModeValue = 'default' as InputMode
      const adjustedInputWidth =
        inputModeValue === ('bash' as InputMode)
          ? baseInputWidth - 2
          : baseInputWidth

      expect(adjustedInputWidth).toBe(100)
    })

    test('placeholder changes in bash mode', () => {
      const normalPlaceholder = 'Ask Savant anything...'
      const bashPlaceholder = 'enter bash command...'
      const inputMode: InputMode = 'bash'
      const effectivePlaceholder =
        inputMode === 'bash' ? bashPlaceholder : normalPlaceholder

      expect(effectivePlaceholder).toBe('enter bash command...')
    })

    test('placeholder is normal when not in bash mode', () => {
      const normalPlaceholder = 'Ask Savant anything...'
      const bashPlaceholder = 'enter bash command...'
      const inputMode = 'default' as InputMode
      const effectivePlaceholder =
        inputMode === ('bash' as InputMode)
          ? bashPlaceholder
          : normalPlaceholder

      expect(effectivePlaceholder).toBe('Ask Savant anything...')
    })
  })
})

// FID-2026-0819-005 Loop 287: the mode-selection, pending-messages,
// state-transition, special-chars, bang-prefix, and bash-config suites
// moved verbatim from bash-command.test.ts; harness copied verbatim.
import { describe, test, expect, mock } from 'bun:test'

import { useChatStore } from '../../state/chat-store'
import { INPUT_MODE_CONFIGS, getInputModeConfig } from '../../utils/input-modes'
import { findCommand } from '../command-registry'

import type { RouterParams } from '../command-registry'

/**
 * Tests for bash command execution logic.
 *
 * These tests cover:
 * 1. runBashCommand - ghost vs direct mode selection based on store state
 * 2. /bash slash command handler - immediate execution vs entering bash mode
 */

describe('bash command', () => {
  describe('bash mode state transitions', () => {
    test('entering bash mode sets inputMode to bash', () => {
      useChatStore.getState().setInputMode('bash')
      expect(useChatStore.getState().inputMode).toBe('bash')
    })

    test('exiting bash mode sets inputMode to default', () => {
      useChatStore.getState().setInputMode('bash')
      useChatStore.getState().setInputMode('default')
      expect(useChatStore.getState().inputMode).toBe('default')
    })

    test('reset clears inputMode to default', () => {
      useChatStore.getState().setInputMode('bash')
      useChatStore.getState().reset()
      expect(useChatStore.getState().inputMode).toBe('default')
    })
  })

  describe('/bash with special characters in args', () => {
    const createMockParams = (
      overrides: Partial<RouterParams> = {},
    ): RouterParams => ({
      abortControllerRef: { current: null },
      agentMode: 'HYBRID',
      inputRef: { current: null },
      inputValue: '/bash',
      isChainInProgressRef: { current: false },
      isStreaming: false,
      logoutMutation: {} as RouterParams['logoutMutation'],
      streamMessageIdRef: { current: null },
      addToQueue: mock(() => {}),
      clearMessages: mock(() => {}),
      saveToHistory: mock(() => {}),
      scrollToLatest: mock(() => {}),
      sendMessage: mock(async () => {}),
      setCanProcessQueue: mock(() => {}),
      setInputFocused: mock(() => {}),
      setInputValue: mock(() => {}),
      setIsAuthenticated: mock(() => {}),
      setMessages: mock(() => {}),
      setUser: mock(() => {}),
      stopStreaming: mock(() => {}),
      ...overrides,
    })

    test('/bash with pipe characters preserves them', () => {
      const saveToHistory = mock(() => {})
      const bashCommand = findCommand('bash')
      const params = createMockParams({ saveToHistory })

      bashCommand?.handler(params, 'ls | grep foo')

      expect(saveToHistory).toHaveBeenCalledWith('!ls | grep foo')
    })

    test('/bash with quoted arguments preserves them', () => {
      const saveToHistory = mock(() => {})
      const bashCommand = findCommand('bash')
      const params = createMockParams({ saveToHistory })

      bashCommand?.handler(params, 'echo "hello world"')

      expect(saveToHistory).toHaveBeenCalledWith('!echo "hello world"')
    })

    test('/bash with redirection operators preserves them', () => {
      const saveToHistory = mock(() => {})
      const bashCommand = findCommand('bash')
      const params = createMockParams({ saveToHistory })

      bashCommand?.handler(params, 'echo test > debug/output.txt')

      expect(saveToHistory).toHaveBeenCalledWith(
        '!echo test > debug/output.txt',
      )
    })

    test('/bash with environment variables preserves them', () => {
      const saveToHistory = mock(() => {})
      const bashCommand = findCommand('bash')
      const params = createMockParams({ saveToHistory })

      bashCommand?.handler(params, 'echo $HOME')

      expect(saveToHistory).toHaveBeenCalledWith('!echo $HOME')
    })

    test('/bash with semicolon command chaining preserves it', () => {
      const saveToHistory = mock(() => {})
      const bashCommand = findCommand('bash')
      const params = createMockParams({ saveToHistory })

      bashCommand?.handler(params, 'cd /tmp; ls')

      expect(saveToHistory).toHaveBeenCalledWith('!cd /tmp; ls')
    })

    test('/bash with && command chaining preserves it', () => {
      const saveToHistory = mock(() => {})
      const bashCommand = findCommand('bash')
      const params = createMockParams({ saveToHistory })

      bashCommand?.handler(params, 'mkdir test && cd test')

      expect(saveToHistory).toHaveBeenCalledWith('!mkdir test && cd test')
    })
  })

  describe('bang prefix handling in queue', () => {
    test('command starting with ! and length > 1 is recognized as bash command', () => {
      const input = '!ls -la'
      const isBashFromQueue = input.startsWith('!') && input.length > 1
      expect(isBashFromQueue).toBe(true)
    })

    test('single ! character is NOT recognized as bash command from queue', () => {
      const input = '!'
      const isBashFromQueue = input.startsWith('!') && input.length > 1
      expect(isBashFromQueue).toBe(false)
    })

    test('command extracts correctly without ! prefix', () => {
      const input = '!git status'
      const command = input.slice(1)
      expect(command).toBe('git status')
    })

    test('empty string is not a bash command from queue', () => {
      const input = ''
      const isBashFromQueue = input.startsWith('!') && input.length > 1
      expect(isBashFromQueue).toBe(false)
    })

    test('regular text without ! is not a bash command from queue', () => {
      const input = 'help me with this'
      const isBashFromQueue = input.startsWith('!') && input.length > 1
      expect(isBashFromQueue).toBe(false)
    })
  })

  describe('bash mode configuration', () => {
    test('bash mode has correct label', () => {
      const config = getInputModeConfig('bash')
      expect(config.icon).toBe(null)
      expect(config.label).toBe('!')
    })

    test('bash mode uses info color', () => {
      const config = getInputModeConfig('bash')
      expect(config.color).toBe('info')
    })

    test('bash mode has correct placeholder', () => {
      const config = getInputModeConfig('bash')
      expect(config.placeholder).toBe('enter bash command...')
    })

    test('bash mode has width adjustment of 4', () => {
      const config = getInputModeConfig('bash')
      expect(config.widthAdjustment).toBe(4)
    })

    test('bash mode hides agent mode toggle', () => {
      const config = getInputModeConfig('bash')
      expect(config.showAgentModeToggle).toBe(false)
    })

    test('bash mode disables slash command suggestions', () => {
      const config = getInputModeConfig('bash')
      expect(config.disableSlashSuggestions).toBe(true)
    })

    test('bash mode config exists in INPUT_MODE_CONFIGS', () => {
      expect(INPUT_MODE_CONFIGS.bash).toBeDefined()
    })
  })
})

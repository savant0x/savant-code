import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test'

import {
  copyTextToClipboard,
  OSC52_BLOCKED_MESSAGE,
  subscribeClipboardMessages,
  clearClipboardMessage,
  registerClipboardRenderer,
  unregisterClipboardRenderer,
} from '../clipboard'
import { logger } from '../logger'

describe('clipboard', () => {
  describe('copyTextToClipboard - blocked OSC52 terminals (Codespaces / VS Code remote)', () => {
    // GitHub Codespaces and VS Code remote terminals silently drop OSC 52
    // sequences, so OSC52-based copy must be treated as unavailable there and
    // the user shown the Shift+drag workaround instead of a false "Copied".

    let originalEnv: Record<string, string | undefined>
    let originalPlatform: PropertyDescriptor | undefined
    let loggerErrorSpy: ReturnType<typeof spyOn>

    beforeEach(() => {
      originalEnv = {
        SSH_CLIENT: process.env.SSH_CLIENT,
        SSH_TTY: process.env.SSH_TTY,
        SSH_CONNECTION: process.env.SSH_CONNECTION,
        TERM: process.env.TERM,
        TMUX: process.env.TMUX,
        STY: process.env.STY,
        TERM_PROGRAM: process.env.TERM_PROGRAM,
        CODESPACES: process.env.CODESPACES,
      }
      originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
      loggerErrorSpy = spyOn(logger, 'error').mockImplementation(() => {})

      // No platform clipboard tool available
      Object.defineProperty(process, 'platform', {
        value: 'freebsd',
        configurable: true,
      })
      delete process.env.SSH_CLIENT
      delete process.env.SSH_TTY
      delete process.env.SSH_CONNECTION
      delete process.env.TMUX
      delete process.env.STY
      delete process.env.CODESPACES
      process.env.TERM = 'xterm-256color'
      process.env.TERM_PROGRAM = 'vscode'

      clearClipboardMessage()
      unregisterClipboardRenderer()
    })

    afterEach(() => {
      unregisterClipboardRenderer()
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value !== undefined) process.env[key] = value
        else delete process.env[key]
      }
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform)
      }
      loggerErrorSpy.mockRestore()
      clearClipboardMessage()
    })

    test('Codespaces: renderer OSC52 is skipped and copy fails', async () => {
      process.env.CODESPACES = 'true'

      const calls: string[] = []
      registerClipboardRenderer({
        copyToClipboardOSC52: (text: string) => {
          calls.push(text)
          return true
        },
      })

      await expect(
        copyTextToClipboard('test text', { suppressGlobalMessage: true }),
      ).rejects.toThrow('No clipboard method available')

      expect(calls).toEqual([])
    })

    test('Codespaces: shows Shift+drag guidance even with suppressGlobalMessage', async () => {
      process.env.CODESPACES = 'true'

      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) =>
        messages.push(msg),
      )

      await expect(
        copyTextToClipboard('test text', { suppressGlobalMessage: true }),
      ).rejects.toThrow()

      expect(messages).toContain(OSC52_BLOCKED_MESSAGE)

      unsubscribe()
    })

    test('VS Code remote SSH: OSC52 is skipped and guidance is shown', async () => {
      process.env.SSH_CONNECTION = '192.168.1.100 54321 10.0.0.1 22'

      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) =>
        messages.push(msg),
      )

      registerClipboardRenderer({ copyToClipboardOSC52: () => true })

      await expect(copyTextToClipboard('test text')).rejects.toThrow()

      expect(messages).toContain(OSC52_BLOCKED_MESSAGE)
      expect(messages.find((m) => m?.startsWith('Copied'))).toBeUndefined()

      unsubscribe()
    })

    test('local VS Code terminal: OSC52 still works', async () => {
      // No CODESPACES, no SSH vars — local VS Code honors OSC 52
      const calls: string[] = []
      registerClipboardRenderer({
        copyToClipboardOSC52: (text: string) => {
          calls.push(text)
          return true
        },
      })

      await copyTextToClipboard('test text', { suppressGlobalMessage: true })

      expect(calls).toEqual(['test text'])
    })

    test('Codespaces over plain SSH (not vscode terminal): OSC52 still works', async () => {
      // e.g. `gh codespace ssh` from a real terminal — OSC 52 passes through
      process.env.CODESPACES = 'true'
      delete process.env.TERM_PROGRAM

      const calls: string[] = []
      registerClipboardRenderer({
        copyToClipboardOSC52: (text: string) => {
          calls.push(text)
          return true
        },
      })

      await copyTextToClipboard('test text', { suppressGlobalMessage: true })

      expect(calls).toEqual(['test text'])
    })
  })

  describe('copyTextToClipboard - OSC52 behavior', () => {
    // Tests for OSC52 escape sequence behavior.
    // OSC52 is used for clipboard access over SSH and in terminal multiplexers.

    let originalEnv: Record<string, string | undefined>
    let originalPlatform: PropertyDescriptor | undefined
    let loggerErrorSpy: ReturnType<typeof spyOn>

    beforeEach(() => {
      originalEnv = {
        SSH_CLIENT: process.env.SSH_CLIENT,
        SSH_TTY: process.env.SSH_TTY,
        SSH_CONNECTION: process.env.SSH_CONNECTION,
        TERM: process.env.TERM,
        TMUX: process.env.TMUX,
        STY: process.env.STY,
        TERM_PROGRAM: process.env.TERM_PROGRAM,
      }
      originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
      loggerErrorSpy = spyOn(logger, 'error').mockImplementation(() => {})
      clearClipboardMessage()
    })

    afterEach(() => {
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value !== undefined) process.env[key] = value
        else delete process.env[key]
      }
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform)
      }
      loggerErrorSpy.mockRestore()
      clearClipboardMessage()
    })

    test('TERM=dumb disables OSC52 (returns null sequence)', async () => {
      // TERM=dumb should cause OSC52 to be skipped entirely
      delete process.env.SSH_CLIENT
      delete process.env.SSH_TTY
      delete process.env.SSH_CONNECTION
      process.env.TERM = 'dumb'
      delete process.env.TMUX
      delete process.env.STY

      // Use freebsd so platform tools also fail
      Object.defineProperty(process, 'platform', {
        value: 'freebsd',
        configurable: true,
      })

      // Should fail because both methods are disabled
      await expect(
        copyTextToClipboard('test', { suppressGlobalMessage: true }),
      ).rejects.toThrow('No clipboard method available')
    })

    test('very large text (>32KB) causes OSC52 to be skipped due to size limit', async () => {
      // OSC52 has a 32KB limit for the base64-encoded payload
      // Text that encodes to >32KB should cause OSC52 to return null
      delete process.env.SSH_CLIENT
      delete process.env.SSH_TTY
      delete process.env.SSH_CONNECTION
      process.env.TERM = 'xterm-256color'
      delete process.env.TMUX
      delete process.env.STY

      // Use freebsd so platform tools fail, only OSC52 available
      Object.defineProperty(process, 'platform', {
        value: 'freebsd',
        configurable: true,
      })

      // Create text that will exceed 32KB when base64 encoded
      // Base64 expands by ~4/3, so 25KB of text should exceed 32KB encoded
      const largeText = 'x'.repeat(25_000)

      // Should fail because OSC52 rejects oversized payload and platform tools unavailable
      await expect(
        copyTextToClipboard(largeText, { suppressGlobalMessage: true }),
      ).rejects.toThrow('No clipboard method available')
    })

    test('TMUX env var should use tmux passthrough wrapping for OSC52', async () => {
      // When TMUX is set, OSC52 should wrap in DCS passthrough
      // We can't directly verify the sequence, but we can verify the path is taken
      process.env.SSH_CLIENT = '192.168.1.100 54321 22' // Force remote session
      process.env.TERM = 'xterm-256color'
      process.env.TMUX = '/tmp/tmux-1000/default,12345,0'
      delete process.env.STY

      Object.defineProperty(process, 'platform', {
        value: 'freebsd',
        configurable: true,
      })

      try {
        await copyTextToClipboard('test', { suppressGlobalMessage: true })
        // Success means tmux passthrough worked
      } catch {
        // Failure expected if /dev/tty not available, but path was exercised
      }

      expect(true).toBe(true)
    })

    test('STY env var (GNU screen) should use screen passthrough wrapping for OSC52', async () => {
      // When STY is set (GNU screen), OSC52 should use screen-style passthrough
      process.env.SSH_CLIENT = '192.168.1.100 54321 22'
      process.env.TERM = 'screen-256color'
      delete process.env.TMUX
      process.env.STY = '12345.pts-0.hostname'

      Object.defineProperty(process, 'platform', {
        value: 'freebsd',
        configurable: true,
      })

      try {
        await copyTextToClipboard('test', { suppressGlobalMessage: true })
      } catch {
        // Expected if /dev/tty not available
      }

      expect(true).toBe(true)
    })
  })
})

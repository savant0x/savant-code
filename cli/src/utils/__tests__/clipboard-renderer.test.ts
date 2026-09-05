import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test'

import {
  copyTextToClipboard,
  subscribeClipboardMessages,
  clearClipboardMessage,
  registerClipboardRenderer,
  unregisterClipboardRenderer,
} from '../clipboard'
import { logger } from '../logger'

import type { ClipboardRenderer } from '../clipboard'

describe('clipboard', () => {
  describe('registerClipboardRenderer and renderer-based copy', () => {
    let originalPlatform: PropertyDescriptor | undefined
    let originalEnv: Record<string, string | undefined>
    let loggerErrorSpy: ReturnType<typeof spyOn>

    beforeEach(() => {
      originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
      originalEnv = {
        SSH_CLIENT: process.env.SSH_CLIENT,
        SSH_TTY: process.env.SSH_TTY,
        SSH_CONNECTION: process.env.SSH_CONNECTION,
        TERM: process.env.TERM,
        TMUX: process.env.TMUX,
        STY: process.env.STY,
        TERM_PROGRAM: process.env.TERM_PROGRAM,
      }
      loggerErrorSpy = spyOn(logger, 'error').mockImplementation(() => {})

      // Use freebsd + dumb terminal to disable platform tools and OSC52,
      // isolating the renderer path.
      Object.defineProperty(process, 'platform', {
        value: 'freebsd',
        configurable: true,
      })
      delete process.env.SSH_CLIENT
      delete process.env.SSH_TTY
      delete process.env.SSH_CONNECTION
      process.env.TERM = 'dumb'
      delete process.env.TMUX
      delete process.env.STY
      delete process.env.TERM_PROGRAM

      clearClipboardMessage()
      unregisterClipboardRenderer()
    })

    afterEach(() => {
      unregisterClipboardRenderer()
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform)
      }
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value !== undefined) process.env[key] = value
        else delete process.env[key]
      }
      loggerErrorSpy.mockRestore()
      clearClipboardMessage()
    })

    test('renderer with copyToClipboardOSC52 returning true succeeds', async () => {
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

    test('renderer with copyToClipboardOSC52 returning false falls through and fails', async () => {
      registerClipboardRenderer({ copyToClipboardOSC52: () => false })

      await expect(
        copyTextToClipboard('test text', { suppressGlobalMessage: true }),
      ).rejects.toThrow('No clipboard method available')
    })

    test('renderer without copyToClipboardOSC52 falls through and fails', async () => {
      registerClipboardRenderer({
        someOtherMethod: () => true,
      } as ClipboardRenderer)

      await expect(
        copyTextToClipboard('test text', { suppressGlobalMessage: true }),
      ).rejects.toThrow('No clipboard method available')
    })

    test('renderer whose copyToClipboardOSC52 throws falls through gracefully', async () => {
      registerClipboardRenderer({
        copyToClipboardOSC52: () => {
          throw new Error('renderer error')
        },
      })

      await expect(
        copyTextToClipboard('test text', { suppressGlobalMessage: true }),
      ).rejects.toThrow('No clipboard method available')
    })

    test('unregisterClipboardRenderer removes renderer so it is no longer used', async () => {
      const calls: string[] = []
      registerClipboardRenderer({
        copyToClipboardOSC52: (text: string) => {
          calls.push(text)
          return true
        },
      })
      unregisterClipboardRenderer()

      await expect(
        copyTextToClipboard('test text', { suppressGlobalMessage: true }),
      ).rejects.toThrow('No clipboard method available')

      expect(calls).toEqual([])
    })

    test('renderer is tried in remote sessions (SSH) before manual OSC52', async () => {
      // Set up as remote session
      process.env.SSH_CLIENT = '192.168.1.100 54321 22'
      process.env.TERM = 'xterm-256color'

      const calls: string[] = []
      registerClipboardRenderer({
        copyToClipboardOSC52: () => {
          calls.push('renderer')
          return true
        },
      })

      await copyTextToClipboard('test text', { suppressGlobalMessage: true })

      expect(calls).toEqual(['renderer'])
    })

    test('shows success message when renderer copy succeeds', async () => {
      registerClipboardRenderer({ copyToClipboardOSC52: () => true })

      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) =>
        messages.push(msg),
      )

      await copyTextToClipboard('Hello world')

      expect(messages).toContain('Copied: "Hello world"')

      unsubscribe()
    })
  })
})

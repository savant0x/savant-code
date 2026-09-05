import { createMockTimers } from '@savant-code/common/testing/mocks/timers'
import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test'

import {
  copyTextToClipboard,
  subscribeClipboardMessages,
  clearClipboardMessage,
} from '../clipboard'
import { logger } from '../logger'

import type { MockTimers } from '@savant-code/common/testing/mocks/timers'

describe('clipboard', () => {
  describe('copyTextToClipboard - error handling when both methods fail', () => {
    let mockTimers: MockTimers
    let loggerErrorSpy: ReturnType<typeof spyOn>
    let originalPlatform: PropertyDescriptor | undefined
    let originalEnv: {
      SSH_CLIENT?: string
      SSH_TTY?: string
      SSH_CONNECTION?: string
      TERM?: string
    }

    beforeEach(() => {
      mockTimers = createMockTimers()
      mockTimers.install()

      originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
      // Use a platform that has no clipboard tool (freebsd)
      Object.defineProperty(process, 'platform', {
        value: 'freebsd',
        configurable: true,
      })

      // Save env vars
      originalEnv = {
        SSH_CLIENT: process.env.SSH_CLIENT,
        SSH_TTY: process.env.SSH_TTY,
        SSH_CONNECTION: process.env.SSH_CONNECTION,
        TERM: process.env.TERM,
      }
      // Clear SSH env vars to ensure local session detection
      delete process.env.SSH_CLIENT
      delete process.env.SSH_TTY
      delete process.env.SSH_CONNECTION
      // Set TERM=dumb to disable OSC52 (it returns early for dumb terminals)
      process.env.TERM = 'dumb'

      loggerErrorSpy = spyOn(logger, 'error').mockImplementation(() => {})

      clearClipboardMessage()
    })

    afterEach(() => {
      mockTimers.restore()
      loggerErrorSpy.mockRestore()
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform)
      }
      // Restore env vars
      if (originalEnv.SSH_CLIENT !== undefined)
        process.env.SSH_CLIENT = originalEnv.SSH_CLIENT
      else delete process.env.SSH_CLIENT
      if (originalEnv.SSH_TTY !== undefined)
        process.env.SSH_TTY = originalEnv.SSH_TTY
      else delete process.env.SSH_TTY
      if (originalEnv.SSH_CONNECTION !== undefined)
        process.env.SSH_CONNECTION = originalEnv.SSH_CONNECTION
      else delete process.env.SSH_CONNECTION
      if (originalEnv.TERM !== undefined) process.env.TERM = originalEnv.TERM
      else delete process.env.TERM
      clearClipboardMessage()
    })

    test('shows default error message when both methods fail', async () => {
      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) =>
        messages.push(msg),
      )

      await expect(copyTextToClipboard('test text')).rejects.toThrow()

      expect(messages).toContain('Failed to copy to clipboard')

      unsubscribe()
    })

    test('shows custom error message when provided', async () => {
      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) =>
        messages.push(msg),
      )

      await expect(
        copyTextToClipboard('test text', { errorMessage: 'Custom error!' }),
      ).rejects.toThrow()

      expect(messages).toContain('Custom error!')

      unsubscribe()
    })

    test('suppresses error message when suppressGlobalMessage is true', async () => {
      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) =>
        messages.push(msg),
      )
      messages.length = 0 // Clear initial

      await expect(
        copyTextToClipboard('test text', { suppressGlobalMessage: true }),
      ).rejects.toThrow()

      expect(messages.filter((m) => m !== null)).toHaveLength(0)

      unsubscribe()
    })

    test('logs error when both methods fail', async () => {
      await expect(
        copyTextToClipboard('test text', { suppressGlobalMessage: true }),
      ).rejects.toThrow()

      expect(loggerErrorSpy).toHaveBeenCalled()
    })

    test('throws error when both methods fail', async () => {
      await expect(
        copyTextToClipboard('test text', { suppressGlobalMessage: true }),
      ).rejects.toThrow('No clipboard method available')
    })
  })
})

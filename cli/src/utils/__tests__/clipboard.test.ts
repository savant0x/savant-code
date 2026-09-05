import { createMockTimers } from '@savant-code/common/testing/mocks/timers'
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'

import {
  copyTextToClipboard,
  showClipboardMessage,
  subscribeClipboardMessages,
  clearClipboardMessage,
} from '../clipboard'

import type { MockTimers } from '@savant-code/common/testing/mocks/timers'

/**
 * Tests for clipboard.ts functionality (message + subscription surface).
 *
 * What IS tested here:
 * - Message subscription system (show, clear, timer cancellation, multiple subscribers)
 * - Empty/whitespace text handling (early return)
 *
 * Sibling modules cover the rest of the clipboard surface:
 * - clipboard-copy-formatting.test.ts (success message formatting, macOS integration)
 * - clipboard-copy-errors.test.ts (error handling when both copy methods fail)
 * - clipboard-renderer.test.ts (registerClipboardRenderer and renderer-based copy)
 * - clipboard-ssh-detection.test.ts (SSH session detection behavior)
 * - clipboard-osc52.test.ts (blocked OSC52 terminals + OSC52 behavior)
 */

describe('clipboard', () => {
  describe('showClipboardMessage and subscriptions', () => {
    let mockTimers: MockTimers
    let receivedMessages: (string | null)[]

    beforeEach(() => {
      mockTimers = createMockTimers()
      mockTimers.install()
      receivedMessages = []
      clearClipboardMessage()
    })

    afterEach(() => {
      mockTimers.restore()
      clearClipboardMessage()
    })

    test('notifies subscribers when message is shown', () => {
      const unsubscribe = subscribeClipboardMessages((msg) => {
        receivedMessages.push(msg)
      })

      showClipboardMessage('Test message')

      expect(receivedMessages).toContain('Test message')

      unsubscribe()
    })

    test('clears message after default duration (3000ms)', () => {
      const unsubscribe = subscribeClipboardMessages((msg) => {
        receivedMessages.push(msg)
      })

      showClipboardMessage('Test message')
      expect(receivedMessages).toContain('Test message')

      mockTimers.advanceBy(3001)

      expect(receivedMessages[receivedMessages.length - 1]).toBeNull()

      unsubscribe()
    })

    test('clears message after custom duration', () => {
      const unsubscribe = subscribeClipboardMessages((msg) => {
        receivedMessages.push(msg)
      })

      showClipboardMessage('Test message', { durationMs: 1000 })

      mockTimers.advanceBy(1001)

      expect(receivedMessages[receivedMessages.length - 1]).toBeNull()

      unsubscribe()
    })

    test('cancels previous timer when new message is shown', () => {
      // Subscribe first, then show messages
      const unsubscribe = subscribeClipboardMessages((msg) => {
        receivedMessages.push(msg)
      })

      // Clear initial null from subscription
      receivedMessages = []

      showClipboardMessage('First message', { durationMs: 5000 })
      mockTimers.advanceBy(2000)
      showClipboardMessage('Second message', { durationMs: 5000 })
      mockTimers.advanceBy(3000)

      // First message's timer should have been cancelled, so no null yet
      expect(receivedMessages).toEqual(['First message', 'Second message'])

      unsubscribe()
    })

    test('unsubscribe stops receiving messages', () => {
      const unsubscribe = subscribeClipboardMessages((msg) => {
        receivedMessages.push(msg)
      })

      // Clear initial null
      receivedMessages = []

      showClipboardMessage('Before unsubscribe')
      unsubscribe()
      showClipboardMessage('After unsubscribe')

      expect(receivedMessages).toContain('Before unsubscribe')
      expect(receivedMessages).not.toContain('After unsubscribe')
    })

    test('multiple subscribers all receive messages', () => {
      const messages1: (string | null)[] = []
      const messages2: (string | null)[] = []

      const unsub1 = subscribeClipboardMessages((msg) => messages1.push(msg))
      const unsub2 = subscribeClipboardMessages((msg) => messages2.push(msg))

      showClipboardMessage('Broadcast message')

      expect(messages1).toContain('Broadcast message')
      expect(messages2).toContain('Broadcast message')

      unsub1()
      unsub2()
    })

    test('clearClipboardMessage immediately clears the message', () => {
      const unsubscribe = subscribeClipboardMessages((msg) => {
        receivedMessages.push(msg)
      })

      showClipboardMessage('Test message', { durationMs: 10000 })
      clearClipboardMessage()

      expect(receivedMessages[receivedMessages.length - 1]).toBeNull()

      unsubscribe()
    })
  })

  describe('copyTextToClipboard - empty/whitespace handling', () => {
    beforeEach(() => {
      clearClipboardMessage()
    })

    afterEach(() => {
      clearClipboardMessage()
    })

    test('returns early for empty string', async () => {
      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) =>
        messages.push(msg),
      )
      messages.length = 0 // Clear initial null

      await copyTextToClipboard('')

      // Should not show any success or error message
      expect(messages.filter((m) => m !== null)).toHaveLength(0)

      unsubscribe()
    })

    test('returns early for whitespace-only string', async () => {
      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) =>
        messages.push(msg),
      )
      messages.length = 0 // Clear initial null

      await copyTextToClipboard('   \n\t  ')

      // Should not show any success or error message
      expect(messages.filter((m) => m !== null)).toHaveLength(0)

      unsubscribe()
    })
  })
})

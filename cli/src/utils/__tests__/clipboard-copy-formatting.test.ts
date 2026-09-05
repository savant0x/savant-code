import { execSync } from 'child_process'

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'

import {
  copyTextToClipboard,
  subscribeClipboardMessages,
  clearClipboardMessage,
} from '../clipboard'

// These tests run on macOS with actual pbcopy - skip on other platforms/CI
const shouldRun = process.platform === 'darwin' && !process.env.CI

describe('clipboard', () => {
  describe('copyTextToClipboard - success message formatting', () => {
    beforeEach(() => {
      clearClipboardMessage()
    })

    afterEach(() => {
      clearClipboardMessage()
    })

    test.skipIf(!shouldRun)('formats short text with quotes', async () => {
      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) =>
        messages.push(msg),
      )

      await copyTextToClipboard('Hello')

      expect(messages).toContain('Copied: "Hello"')

      unsubscribe()
    })

    test.skipIf(!shouldRun)('truncates long text with ellipsis', async () => {
      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) =>
        messages.push(msg),
      )

      const longText =
        'This is a very long piece of text that should be truncated because it exceeds the maximum display length'
      await copyTextToClipboard(longText)

      const lastMessage = messages.find((m) => m?.startsWith('Copied:'))
      expect(lastMessage).toBeDefined()
      expect(lastMessage!.length).toBeLessThan(55) // "Copied: " + 40 chars max + quotes
      expect(lastMessage).toContain('…')

      unsubscribe()
    })

    test.skipIf(!shouldRun)('collapses whitespace in preview', async () => {
      const messages: (string | null)[] = []
      const unsubscribe = subscribeClipboardMessages((msg) =>
        messages.push(msg),
      )

      await copyTextToClipboard('Hello\n\n\nWorld\t\tTest')

      expect(messages).toContain('Copied: "Hello World Test"')

      unsubscribe()
    })

    test.skipIf(!shouldRun)(
      'uses custom success message when provided',
      async () => {
        const messages: (string | null)[] = []
        const unsubscribe = subscribeClipboardMessages((msg) =>
          messages.push(msg),
        )

        await copyTextToClipboard('test', { successMessage: 'Custom success!' })

        expect(messages).toContain('Custom success!')

        unsubscribe()
      },
    )

    test.skipIf(!shouldRun)(
      'shows no message when successMessage is null',
      async () => {
        const messages: (string | null)[] = []
        const unsubscribe = subscribeClipboardMessages((msg) =>
          messages.push(msg),
        )
        messages.length = 0 // Clear initial null

        await copyTextToClipboard('test', { successMessage: null })

        expect(messages.filter((m) => m?.startsWith('Copied'))).toHaveLength(0)

        unsubscribe()
      },
    )

    test.skipIf(!shouldRun)(
      'suppresses message when suppressGlobalMessage is true',
      async () => {
        const messages: (string | null)[] = []
        const unsubscribe = subscribeClipboardMessages((msg) =>
          messages.push(msg),
        )
        messages.length = 0 // Clear initial null

        await copyTextToClipboard('test', { suppressGlobalMessage: true })

        expect(messages.filter((m) => m !== null)).toHaveLength(0)

        unsubscribe()
      },
    )
  })

  describe('copyTextToClipboard - integration test', () => {
    // This test actually calls the real clipboard on macOS
    // Skip on CI or non-macOS systems
    const shouldRun = process.platform === 'darwin' && !process.env.CI

    test.skipIf(!shouldRun)(
      'actually copies text to system clipboard on macOS',
      async () => {
        const testText = `clipboard-test-${Date.now()}`

        await copyTextToClipboard(testText, { suppressGlobalMessage: true })

        // Verify with pbpaste
        const clipboardContent = execSync('pbpaste', { encoding: 'utf8' })

        expect(clipboardContent).toBe(testText)
      },
    )
  })
})

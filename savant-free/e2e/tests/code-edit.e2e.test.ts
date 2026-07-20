/**
 * E2E test that verifies SavantFree can perform a simple code edit.
 *
 * Starts SavantFree in tmux, sends a prompt asking it to add a console.log
 * to a file, and verifies the file was modified correctly.
 *
 * Requires CODEBUFF_API_KEY — skipped if not set.
 */

import { afterEach, describe, expect, test } from 'bun:test'

import { SavantFree$1, requireFreebuffBinary } from '../utils'

const TEST_TIMEOUT = 1_000_000

function getApiKey(): string | null {
  return process.env.CODEBUFF_API_KEY ?? null
}

describe.skip('SavantFree: Code Edit', () => {
  let session: SavantFree$1 | null = null

  afterEach(async () => {
    if (session) {
      await session.stop()
      session = null
    }
  })

  test(
    'adds a console.log to a file',
    async () => {
      if (!getApiKey()) {
        console.log(
          'Skipping code-edit test: CODEBUFF_API_KEY not set. ' +
            'Set it to run code-edit e2e tests.',
        )
        return
      }

      const binary = requireFreebuffBinary()
      const initialContent = [
        'function greet(name) {',
        "  return 'Hello, ' + name",
        '}',
        '',
      ].join('\n')

      // Create the file before starting savant-free so it's in the initial context
      session = await SavantFree$1.start(binary, {
        waitSeconds: 5,
        initialFiles: { 'index.js': initialContent },
      })

      // Wait for the CLI to be fully ready before sending input
      await session.waitForReady()

      // Verify the file was created
      expect(session.readFile('index.js')).toBe(initialContent)

      // Send a prompt asking savant-free to add a console.log
      await session.send('Add console.log("hello world") to index.js')

      // Wait for the file to be modified with the console.log
      const finalContent = await session.waitForFileContent(
        'index.js',
        'console.log',
        900_000,
      )

      expect(finalContent).toContain('console.log')
      expect(finalContent).toContain('hello world')
      // The original function should still be present
      expect(finalContent).toContain('function greet')
    },
    TEST_TIMEOUT,
  )
})

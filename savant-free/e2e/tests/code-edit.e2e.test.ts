/**
 * E2E test that verifies SavantFree can perform a simple code edit.
 *
 * Starts SavantFree in tmux, sends a prompt asking it to add a console.log
 * to a file, and verifies the file was modified correctly.
 *
 * FID-2026-0929-005: the SAVANT_CODE_API_KEY opt-in gate is deleted with the
 * variable it read — nothing in the harness consumes a backend key anymore.
 * Provider credentials must be present in the environment instead.
 */

import { afterEach, describe, expect, test } from 'bun:test'

import { SavantFreeModel, requireSavantFreeBinary } from '../utils'

const TEST_TIMEOUT = 1_000_000

describe.skip('SavantFree: Code Edit', () => {
  let session: SavantFreeModel | null = null

  afterEach(async () => {
    if (session) {
      await session.stop()
      session = null
    }
  })

  test(
    'adds a console.log to a file',
    async () => {
      const binary = requireSavantFreeBinary()
      const initialContent = [
        'function greet(name) {',
        "  return 'Hello, ' + name",
        '}',
        '',
      ].join('\n')

      // Create the file before starting savant-free so it's in the initial context
      session = await SavantFreeModel.start(binary, {
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

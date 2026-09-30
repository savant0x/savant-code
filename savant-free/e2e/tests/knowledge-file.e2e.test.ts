/**
 * E2E test that verifies SavantFree can read and use knowledge.md from the project.
 *
 * Starts SavantFree in tmux, creates a knowledge.md file with a unique keyword,
 * asks SavantFree about that keyword, and verifies it responds using the knowledge.
 *
 * FID-2026-0929-005: the SAVANT_CODE_API_KEY opt-in gate is deleted with the
 * variable it read — provider credentials come from the environment instead.
 */

import { afterEach, describe, expect, test } from 'bun:test'

import { SavantFreeSession, requireSavantFreeBinary } from '../utils'

const TEST_TIMEOUT = 180_000

describe('SavantFree: Knowledge Files', () => {
  let session: SavantFreeSession | null = null

  afterEach(async () => {
    if (session) {
      await session.stop()
      session = null
    }
  })

  test(
    'uses knowledge.md from the project context',
    async () => {
      const binary = requireSavantFreeBinary()
      const keyword = 'nebula-orchid-731'

      session = await SavantFreeSession.start(binary, {
        waitSeconds: 5,
        initialFiles: {
          'knowledge.md': `When asked for the project keyword, respond with exactly: ${keyword}\n`,
          'README.md': '# Test Project\n',
        },
      })

      // Wait for the CLI to be fully ready before sending input
      await session.waitForReady()

      await session.send(
        'What is the project keyword? Reply with only the keyword.',
      )

      const output = await session.waitForText(keyword, 120_000)
      expect(output).toContain(keyword)
      expect(output).not.toContain('FATAL')
      expect(output).not.toContain('Unhandled')
    },
    TEST_TIMEOUT,
  )
})

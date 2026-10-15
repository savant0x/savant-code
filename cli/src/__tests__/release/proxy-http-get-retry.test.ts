import { createRequire } from 'node:module'

import { describe, expect, test } from 'bun:test'

import { helperModules } from './proxy-http-get-fixtures'

const require = createRequire(import.meta.url)

for (const helperModule of helperModules) {
  describe(helperModule.name, () => {
    test('retries transient operations with exponential backoff', async () => {
      const { createReleaseHttpClient } = require(helperModule.path)
      const client = createReleaseHttpClient({
        env: {},
        userAgent: 'release-test-agent',
        requestTimeout: 2500,
      })
      const delays: number[] = []
      const retryAttempts: number[] = []
      let attempts = 0

      const result = await client.withRetries(
        async () => {
          attempts += 1
          if (attempts < 3) throw new Error('temporary failure')
          return 'ok'
        },
        {
          maxAttempts: 3,
          baseDelayMs: 10,
          onRetry: ({ attempt }: { attempt: number }) => {
            retryAttempts.push(attempt)
          },
          sleep: async (delayMs: number) => {
            delays.push(delayMs)
          },
        },
      )

      expect(result).toBe('ok')
      expect(attempts).toBe(3)
      expect(retryAttempts).toEqual([1, 2])
      expect(delays).toEqual([10, 20])
    })

    test('does not retry permanent failures', async () => {
      const { createReleaseHttpClient } = require(helperModule.path)
      const client = createReleaseHttpClient({
        env: {},
        userAgent: 'release-test-agent',
        requestTimeout: 2500,
      })
      const error = Object.assign(new Error('not found'), { retryable: false })
      let attempts = 0

      await expect(
        client.withRetries(
          async () => {
            attempts += 1
            throw error
          },
          {
            maxAttempts: 3,
            shouldRetry: (caught: Error & { retryable?: boolean }) =>
              caught.retryable !== false,
            sleep: async () => {},
          },
        ),
      ).rejects.toBe(error)
      expect(attempts).toBe(1)
    })
  })
}

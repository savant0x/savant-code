// SavantCode API client test family — TLS/network error formatting.
// Sibling of the Loop 348 decomposition (shared fixtures in
// ./savant-code-api-test-harness).
import { describe, test, expect, mock } from 'bun:test'

import { createSavantCodeApiClient } from '../savant-code-api'
import {
  registerDirectProviderEnvLifecycle,
  type MockFetch,
} from './savant-code-api-test-harness'

registerDirectProviderEnvLifecycle()

describe('createSavantCodeApiClient', () => {
  describe('network error formatting', () => {
    test('formats TLS certificate errors with proxy and trust-store guidance', async () => {
      const mockTlsFetch = mock<MockFetch>(() => {
        const error = new Error('self signed certificate in certificate chain')
        return Promise.reject(error)
      })

      const client = createSavantCodeApiClient({
        baseUrl: 'https://savant-code.com',
        fetch: mockTlsFetch as unknown as typeof fetch,
      })

      await expect(
        client.post('/api/auth/cli/code', { fingerprintId: 'test' }),
      ).rejects.toThrow(
        'TLS certificate verification failed for https://savant-code.com.',
      )
    })

    test('formats nested TLS certificate causes from fetch failures without retrying', async () => {
      const mockTlsFetch = mock<MockFetch>(() => {
        const cause = new Error('self signed certificate in certificate chain')
        const error = new Error('fetch failed', { cause })
        return Promise.reject(error)
      })

      const client = createSavantCodeApiClient({
        baseUrl: 'https://savant-code.com',
        fetch: mockTlsFetch as unknown as typeof fetch,
        retry: {
          maxRetries: 3,
          initialDelayMs: 10,
        },
      })

      await expect(
        client.post('/api/auth/cli/code', { fingerprintId: 'test' }),
      ).rejects.toThrow(
        'TLS certificate verification failed for https://savant-code.com.',
      )
      expect(mockTlsFetch).toHaveBeenCalledTimes(1)
    })
  })
})

// SavantCode API client test family — retry logic + timeout.
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
  describe('retry logic', () => {
    test('should retry on 500 errors', async () => {
      let callCount = 0
      const mockRetryFetch = mock<MockFetch>(() => {
        callCount++
        if (callCount < 3) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: () => Promise.resolve({ error: 'Server error' }),
          } as Response)
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        } as Response)
      })

      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        fetch: mockRetryFetch as unknown as typeof fetch,
        retry: {
          maxRetries: 3,
          initialDelayMs: 10, // Fast for testing
          maxDelayMs: 50,
        },
      })

      const result = await client.get('/api/v1/test')

      expect(result.ok).toBe(true)
      expect(mockRetryFetch).toHaveBeenCalledTimes(3)
    })

    test('should not retry on 400 errors', async () => {
      const mockBadRequestFetch = mock<MockFetch>(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: () => Promise.resolve({ error: 'Invalid input' }),
        } as Response),
      )

      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        fetch: mockBadRequestFetch as unknown as typeof fetch,
        retry: { maxRetries: 3, initialDelayMs: 10 },
      })

      const result = await client.get('/api/v1/test')

      expect(result.ok).toBe(false)
      expect(result.status).toBe(400)
      expect(mockBadRequestFetch).toHaveBeenCalledTimes(1)
    })

    test('should respect retry: false option', async () => {
      const mockServerErrorFetch = mock<MockFetch>(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({ error: 'Server error' }),
        } as Response),
      )

      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        fetch: mockServerErrorFetch as unknown as typeof fetch,
        retry: { maxRetries: 3 },
      })

      const result = await client.get('/api/v1/test', { retry: false })

      expect(result.ok).toBe(false)
      expect(mockServerErrorFetch).toHaveBeenCalledTimes(1)
    })

    test('should retry on network errors', async () => {
      let callCount = 0
      const mockNetworkErrorFetch = mock<MockFetch>(() => {
        callCount++
        if (callCount < 2) {
          return Promise.reject(new Error('Network error: fetch failed'))
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        } as Response)
      })

      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        fetch: mockNetworkErrorFetch as unknown as typeof fetch,
        retry: { maxRetries: 3, initialDelayMs: 10 },
      })

      const result = await client.get('/api/v1/test')

      expect(result.ok).toBe(true)
      expect(mockNetworkErrorFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('timeout', () => {
    test('should pass abort signal to fetch', async () => {
      let receivedSignal: AbortSignal | null | undefined

      const mockFetchWithSignal = mock<MockFetch>(
        async (_url: string, options?: RequestInit) => {
          receivedSignal = options?.signal
          return {
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true }),
          } as Response
        },
      )

      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        fetch: mockFetchWithSignal as unknown as typeof fetch,
        defaultTimeoutMs: 5000,
      })

      await client.get('/api/v1/test', { retry: false })

      expect(receivedSignal).toBeDefined()
      expect(receivedSignal instanceof AbortSignal).toBe(true)
    })

    test('should handle abort error from fetch', async () => {
      const mockAbortFetch = mock<MockFetch>(() => {
        const error = new Error('The operation was aborted')
        error.name = 'AbortError'
        return Promise.reject(error)
      })

      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        fetch: mockAbortFetch as unknown as typeof fetch,
      })

      // Should retry on abort errors
      await expect(
        client.get('/api/v1/test', { retry: false }),
      ).rejects.toThrow('The operation was aborted')
    })
  })
})

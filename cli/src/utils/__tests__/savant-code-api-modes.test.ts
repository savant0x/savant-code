// SavantCode API client test family — direct-provider guard + feedback method.
// Sibling of the Loop 348 decomposition (shared fixtures in
// ./savant-code-api-test-harness).
import { describe, test, expect, mock, beforeEach } from 'bun:test'

import { createSavantCodeApiClient } from '../savant-code-api'
import {
  createDefaultMockFetch,
  registerDirectProviderEnvLifecycle,
  type MockFetch,
  type MockFetchInstance,
} from './savant-code-api-test-harness'

import type { FeedbackRequest } from '@savant-code/common/schemas/feedback'

registerDirectProviderEnvLifecycle()

let mockFetch: MockFetchInstance

beforeEach(() => {
  mockFetch = createDefaultMockFetch()
})

describe('createSavantCodeApiClient', () => {
  describe('direct provider mode', () => {
    beforeEach(() => {
      process.env.DIRECT_PROVIDER = 'openrouter'
    })

    test('request returns 503 error without calling fetch', async () => {
      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        fetch: mockFetch as unknown as typeof fetch,
      })

      const result = await client.get('/api/v1/test', { retry: false })

      expect(mockFetch).not.toHaveBeenCalled()
      expect(result).toEqual({
        ok: false,
        status: 503,
        error: 'Backend unavailable in direct-provider mode',
      })
    })

    test('endpoint methods return 503 error without calling fetch', async () => {
      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        authToken: 'stub_bypass_dev_local',
        fetch: mockFetch as unknown as typeof fetch,
      })

      const result = await client.usage()

      expect(mockFetch).not.toHaveBeenCalled()
      expect(result).toEqual({
        ok: false,
        status: 503,
        error: 'Backend unavailable in direct-provider mode',
      })
    })
  })

  describe('feedback method', () => {
    const minimalFeedbackPayload: FeedbackRequest = {
      category: 'other',
      type: 'general',
      text: 'test feedback',
    }

    test('should not retry on 429 (rate limit) responses', async () => {
      const mockRateLimitFetch = mock<MockFetch>(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          json: () => Promise.resolve({ error: 'Rate limited' }),
        } as Response),
      )

      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        fetch: mockRateLimitFetch as unknown as typeof fetch,
        retry: { maxRetries: 3, initialDelayMs: 10 },
      })

      const result = await client.feedback(minimalFeedbackPayload)

      expect(result.ok).toBe(false)
      expect(result.status).toBe(429)
      expect(mockRateLimitFetch).toHaveBeenCalledTimes(1)
    })

    test('should not retry on 500 responses (non-idempotent endpoint)', async () => {
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
        retry: {
          maxRetries: 3,
          initialDelayMs: 10,
          maxDelayMs: 50,
        },
      })

      const result = await client.feedback(minimalFeedbackPayload)

      expect(result.ok).toBe(false)
      expect(result.status).toBe(500)
      expect(mockServerErrorFetch).toHaveBeenCalledTimes(1)
    })
  })
})

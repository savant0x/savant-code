// SavantCode API client test family — response handling.
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
  describe('response handling', () => {
    test('should return ok response with data', async () => {
      const responseData = { id: 'user-123', email: 'test@example.com' }
      const mockSuccessFetch = mock<MockFetch>(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(responseData),
        } as Response),
      )

      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        fetch: mockSuccessFetch as unknown as typeof fetch,
      })

      const result = await client.get('/api/v1/me', { retry: false })

      expect(result.ok).toBe(true)
      expect(result.status).toBe(200)
      if (result.ok) {
        expect(result.data).toEqual(responseData)
      }
    })

    test('should return error response with message', async () => {
      const mockErrorFetch = mock<MockFetch>(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: () => Promise.resolve({ error: 'Invalid token' }),
        } as Response),
      )

      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        fetch: mockErrorFetch as unknown as typeof fetch,
      })

      const result = await client.get('/api/v1/me', { retry: false })

      expect(result.ok).toBe(false)
      expect(result.status).toBe(401)
      if (!result.ok) {
        expect(result.error).toBe('Invalid token')
      }
    })

    test('should handle non-JSON error responses', async () => {
      const mockErrorFetch = mock<MockFetch>(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.reject(new Error('Not JSON')),
          text: () => Promise.resolve('Server error occurred'),
        } as unknown as Response),
      )

      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        fetch: mockErrorFetch as unknown as typeof fetch,
      })

      const result = await client.get('/api/v1/test', { retry: false })

      expect(result.ok).toBe(false)
      expect(result.status).toBe(500)
      if (!result.ok) {
        expect(result.error).toBe('Server error occurred')
      }
    })

    test('should handle 204 No Content responses', async () => {
      const mockNoContentFetch = mock<MockFetch>(() =>
        Promise.resolve({
          ok: true,
          status: 204,
          json: () => Promise.reject(new Error('No content')),
        } as Response),
      )

      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        fetch: mockNoContentFetch as unknown as typeof fetch,
      })

      const result = await client.delete('/api/v1/test/123', { retry: false })

      expect(result.ok).toBe(true)
      expect(result.status).toBe(204)
    })
  })
})

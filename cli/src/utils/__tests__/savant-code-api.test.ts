// SavantCode API client test family — client creation + HTTP verbs.
// Sibling of the Loop 348 decomposition (shared fixtures in
// ./savant-code-api-test-harness).
import { describe, test, expect, beforeEach } from 'bun:test'

import { createSavantCodeApiClient } from '../savant-code-api'
import {
  createDefaultMockFetch,
  registerDirectProviderEnvLifecycle,
  type MockFetchInstance,
} from './savant-code-api-test-harness'

registerDirectProviderEnvLifecycle()

let mockFetch: MockFetchInstance

beforeEach(() => {
  mockFetch = createDefaultMockFetch()
})

describe('createSavantCodeApiClient', () => {
  describe('client creation', () => {
    test('should create client with default base URL', () => {
      const client = createSavantCodeApiClient()
      expect(client.baseUrl).toBeTruthy()
    })

    test('should create client with custom base URL', () => {
      const client = createSavantCodeApiClient({
        baseUrl: 'https://custom.api',
      })
      expect(client.baseUrl).toBe('https://custom.api')
    })

    test('should store auth token', () => {
      const client = createSavantCodeApiClient({ authToken: 'test-token' })
      expect(client.authToken).toBe('test-token')
    })
  })

  describe('GET requests', () => {
    test('should make GET request with correct URL', async () => {
      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        fetch: mockFetch as unknown as typeof fetch,
      })

      await client.get('/api/v1/test', { retry: false })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit | undefined]
      expect(url).toBe('https://test.api/api/v1/test')
    })

    test('should add query parameters', async () => {
      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        fetch: mockFetch as unknown as typeof fetch,
      })

      await client.get('/api/v1/me', {
        query: { fields: 'id,email' },
        retry: false,
      })

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit | undefined]
      expect(url).toBe('https://test.api/api/v1/me?fields=id%2Cemail')
    })

    test('should include Authorization header when authToken provided', async () => {
      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        authToken: 'my-token',
        fetch: mockFetch as unknown as typeof fetch,
      })

      await client.get('/api/v1/test', { retry: false })

      const [, options] = mockFetch.mock.calls[0] as [
        string,
        RequestInit | undefined,
      ]
      expect(options?.headers).toEqual({
        Authorization: 'Bearer my-token',
      })
    })

    test('should not include Authorization header when includeAuth is false', async () => {
      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        authToken: 'my-token',
        fetch: mockFetch as unknown as typeof fetch,
      })

      await client.get('/api/v1/test', { includeAuth: false, retry: false })

      const [, options] = mockFetch.mock.calls[0] as [
        string,
        RequestInit | undefined,
      ]
      expect(options?.headers).toEqual({})
    })
  })

  describe('POST requests', () => {
    test('should make POST request with JSON body', async () => {
      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        fetch: mockFetch as unknown as typeof fetch,
      })

      await client.post('/api/v1/test', { key: 'value' }, { retry: false })

      const [, options] = mockFetch.mock.calls[0] as [
        string,
        RequestInit | undefined,
      ]
      expect(options?.method).toBe('POST')
      expect(options?.headers).toEqual({
        'Content-Type': 'application/json',
      })
      expect(options?.body).toBe('{"key":"value"}')
    })

    test('should include Cookie header when includeCookie is true', async () => {
      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        authToken: 'my-token',
        fetch: mockFetch as unknown as typeof fetch,
      })

      await client.post(
        '/api/v1/test',
        { data: 'test' },
        { includeCookie: true, includeAuth: false, retry: false },
      )

      const [, options] = mockFetch.mock.calls[0] as [
        string,
        RequestInit | undefined,
      ]
      expect(options?.headers).toEqual({
        'Content-Type': 'application/json',
        Cookie: 'next-auth.session-token=my-token;',
      })
    })
  })

  describe('PUT requests', () => {
    test('should make PUT request with JSON body', async () => {
      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        fetch: mockFetch as unknown as typeof fetch,
      })

      await client.put('/api/v1/test', { key: 'value' }, { retry: false })

      const [, options] = mockFetch.mock.calls[0] as [
        string,
        RequestInit | undefined,
      ]
      expect(options?.method).toBe('PUT')
      expect(options?.headers).toEqual({
        'Content-Type': 'application/json',
      })
    })
  })

  describe('PATCH requests', () => {
    test('should make PATCH request with JSON body', async () => {
      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        fetch: mockFetch as unknown as typeof fetch,
      })

      await client.patch('/api/v1/test', { key: 'value' }, { retry: false })

      const [, options] = mockFetch.mock.calls[0] as [
        string,
        RequestInit | undefined,
      ]
      expect(options?.method).toBe('PATCH')
    })
  })

  describe('DELETE requests', () => {
    test('should make DELETE request without body', async () => {
      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        fetch: mockFetch as unknown as typeof fetch,
      })

      await client.delete('/api/v1/test/123', { retry: false })

      const [url, options] = mockFetch.mock.calls[0] as [
        string,
        RequestInit | undefined,
      ]
      expect(url).toBe('https://test.api/api/v1/test/123')
      expect(options?.method).toBe('DELETE')
      expect(options?.body).toBeUndefined()
    })
  })

  describe('custom headers', () => {
    test('should merge custom headers', async () => {
      const client = createSavantCodeApiClient({
        baseUrl: 'https://test.api',
        authToken: 'my-token',
        fetch: mockFetch as unknown as typeof fetch,
      })

      await client.get('/api/v1/test', {
        headers: { 'X-Custom-Header': 'custom-value' },
        retry: false,
      })

      const [, options] = mockFetch.mock.calls[0] as [
        string,
        RequestInit | undefined,
      ]
      expect(options?.headers).toEqual({
        'X-Custom-Header': 'custom-value',
        Authorization: 'Bearer my-token',
      })
    })
  })
})

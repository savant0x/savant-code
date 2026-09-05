// use-usage-query test family — fetchUsageData HTTP contract.
// Sibling of the Loop 355 decomposition (module-level cache/env lifecycle
// replicated per file, matching the original monolith).
import { createMockLogger } from '@savant-code/common/testing/mocks/logger'
import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'

import { resetActivityQueryCache } from '../use-activity-query'
import { fetchUsageData } from '../use-usage-query'

import type { ClientEnv } from '@savant-code/common/types/contracts/env'

const originalDirectProvider = process.env.DIRECT_PROVIDER

beforeEach(() => {
  resetActivityQueryCache()
  process.env.DIRECT_PROVIDER = ''
})

afterEach(() => {
  process.env.DIRECT_PROVIDER = originalDirectProvider
})

describe('fetchUsageData', () => {
  const originalFetch = globalThis.fetch
  // The original may legitimately be unset (machines without the var in
  // .env.local). Restoring with `= undefined` coerces to the STRING
  // "undefined", poisoning every later spawned child's zod env validation
  // (root cause of the gateway ready-line child crash under the full
  // suite) — so an unset original is restored by DELETING the key.
  const originalEnv = process.env.NEXT_PUBLIC_SAVANT_FREE_APP_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SAVANT_FREE_APP_URL =
      'https://test.savant-code.local'
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_SAVANT_FREE_APP_URL
    } else {
      process.env.NEXT_PUBLIC_SAVANT_FREE_APP_URL = originalEnv
    }
    mock.restore()
  })

  test('should fetch usage data successfully', async () => {
    const mockResponse = {
      type: 'usage-response' as const,
      usage: 100,
      remainingBalance: 500,
      balanceBreakdown: { free: 300, paid: 200 },
      next_quota_reset: '2024-02-01T00:00:00.000Z',
    }

    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ) as unknown as typeof fetch

    const result = await fetchUsageData({ authToken: 'test-token' })

    expect(result).toEqual(mockResponse)
  })

  test('should handle full balance breakdown with all fields', async () => {
    const mockResponse = {
      type: 'usage-response' as const,
      usage: 250,
      remainingBalance: 1000,
      balanceBreakdown: {
        free: 100,
        paid: 500,
        ad: 200,
        referral: 150,
        admin: 50,
      },
      next_quota_reset: '2024-03-01T00:00:00.000Z',
      autoTopupEnabled: true,
    }

    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ) as unknown as typeof fetch

    const result = await fetchUsageData({ authToken: 'test-token' })

    expect(result).toEqual(mockResponse)
    expect(result.balanceBreakdown?.ad).toBe(200)
    expect(result.balanceBreakdown?.referral).toBe(150)
    expect(result.balanceBreakdown?.admin).toBe(50)
    expect(result.autoTopupEnabled).toBe(true)
  })

  test('should handle null remaining balance', async () => {
    const mockResponse = {
      type: 'usage-response' as const,
      usage: 0,
      remainingBalance: null,
      next_quota_reset: null,
    }

    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ) as unknown as typeof fetch

    const result = await fetchUsageData({ authToken: 'test-token' })

    expect(result.remainingBalance).toBeNull()
    expect(result.next_quota_reset).toBeNull()
    expect(result.balanceBreakdown).toBeUndefined()
  })

  test('should handle zero usage and balance', async () => {
    const mockResponse = {
      type: 'usage-response' as const,
      usage: 0,
      remainingBalance: 0,
      balanceBreakdown: { free: 0, paid: 0 },
      next_quota_reset: '2024-02-01T00:00:00.000Z',
    }

    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ) as unknown as typeof fetch

    const result = await fetchUsageData({ authToken: 'test-token' })

    expect(result.usage).toBe(0)
    expect(result.remainingBalance).toBe(0)
  })

  test('should throw error on failed request', async () => {
    globalThis.fetch = mock(
      async () => new Response('Error', { status: 500 }),
    ) as unknown as typeof fetch
    const mockLogger = createMockLogger()

    await expect(
      fetchUsageData({ authToken: 'test-token', logger: mockLogger }),
    ).rejects.toThrow('Failed to fetch usage: 500')
  })

  test('should throw error on 401 unauthorized', async () => {
    globalThis.fetch = mock(
      async () => new Response('Unauthorized', { status: 401 }),
    ) as unknown as typeof fetch
    const mockLogger = createMockLogger()

    await expect(
      fetchUsageData({ authToken: 'invalid-token', logger: mockLogger }),
    ).rejects.toThrow('Failed to fetch usage: 401')
  })

  test('should throw error on 402 payment required', async () => {
    globalThis.fetch = mock(
      async () => new Response('Payment Required', { status: 402 }),
    ) as unknown as typeof fetch
    const mockLogger = createMockLogger()

    await expect(
      fetchUsageData({ authToken: 'test-token', logger: mockLogger }),
    ).rejects.toThrow('Failed to fetch usage: 402')
  })

  test('should throw error when app URL is not set', async () => {
    process.env.NEXT_PUBLIC_SAVANT_FREE_APP_URL = ''

    await expect(
      fetchUsageData({
        authToken: 'test-token',
      }),
    ).rejects.toThrow('NEXT_PUBLIC_SAVANT_FREE_APP_URL is not set')
  })

  test('should send correct request body', async () => {
    let capturedBody: string | undefined

    globalThis.fetch = mock(async (url: string, init?: RequestInit) => {
      capturedBody = init?.body as string
      return new Response(
        JSON.stringify({
          type: 'usage-response',
          usage: 0,
          remainingBalance: 100,
          next_quota_reset: null,
        }),
        { status: 200 },
      )
    }) as unknown as typeof fetch

    await fetchUsageData({ authToken: 'my-auth-token' })

    expect(capturedBody).toBeDefined()
    const parsed = JSON.parse(capturedBody!)
    expect(parsed.fingerprintId).toBe('cli-usage')
    expect(parsed.authToken).toBe('my-auth-token')
  })

  test('should call correct API endpoint', async () => {
    let capturedUrl: string | undefined

    globalThis.fetch = mock(async (url: string) => {
      capturedUrl = url
      return new Response(
        JSON.stringify({
          type: 'usage-response',
          usage: 0,
          remainingBalance: 100,
          next_quota_reset: null,
        }),
        { status: 200 },
      )
    }) as unknown as typeof fetch

    await fetchUsageData({
      authToken: 'test-token',
      clientEnv: {
        NEXT_PUBLIC_SAVANT_FREE_APP_URL: 'https://test.savant-code.local',
      } as ClientEnv,
    })

    expect(capturedUrl).toBe('https://test.savant-code.local/api/v1/usage')
  })

  test('should log error on failed request', async () => {
    globalThis.fetch = mock(
      async () => new Response('Server Error', { status: 503 }),
    ) as unknown as typeof fetch

    const mockLogger = createMockLogger()

    await expect(
      fetchUsageData({ authToken: 'test-token', logger: mockLogger }),
    ).rejects.toThrow()

    expect(mockLogger.error).toHaveBeenCalledWith(
      { status: 503 },
      'Failed to fetch usage data from API',
    )
  })
})

describe('fetchUsageData > direct provider mode', () => {
  test('returns unlimited usage stub without calling API', async () => {
    process.env.DIRECT_PROVIDER = 'openrouter'
    let fetchCalled = false
    globalThis.fetch = mock(async () => {
      fetchCalled = true
      return new Response(JSON.stringify({}), { status: 200 })
    }) as unknown as typeof fetch

    const result = await fetchUsageData({ authToken: 'test-token' })

    expect(fetchCalled).toBe(false)
    expect(result).toEqual({
      type: 'usage-response',
      usage: 0,
      remainingBalance: Number.MAX_SAFE_INTEGER,
      next_quota_reset: null,
    })
  })
})

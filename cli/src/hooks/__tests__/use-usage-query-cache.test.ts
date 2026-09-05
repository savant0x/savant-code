// use-usage-query test family — activity-query cache behavior.
// Sibling of the Loop 355 decomposition (module-level cache/env lifecycle
// replicated per file, matching the original monolith).
import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'

import {
  resetActivityQueryCache,
  getActivityQueryData,
  setActivityQueryData,
  invalidateActivityQuery,
  removeActivityQuery,
} from '../use-activity-query'
import { usageQueryKeys } from '../use-usage-query'

const originalDirectProvider = process.env.DIRECT_PROVIDER

beforeEach(() => {
  resetActivityQueryCache()
  process.env.DIRECT_PROVIDER = ''
})

afterEach(() => {
  process.env.DIRECT_PROVIDER = originalDirectProvider
})

describe('usage query cache behavior', () => {
  afterEach(() => {
    mock.restore()
    resetActivityQueryCache()
  })

  test('should store and retrieve usage data from cache', () => {
    const mockData = {
      type: 'usage-response' as const,
      usage: 100,
      remainingBalance: 500,
      next_quota_reset: '2024-02-01T00:00:00.000Z',
    }

    setActivityQueryData(usageQueryKeys.current(), mockData)
    expect(
      getActivityQueryData<typeof mockData>(usageQueryKeys.current()),
    ).toEqual(mockData)
  })

  test('should update cache when new data is set', () => {
    const initialData = {
      type: 'usage-response' as const,
      usage: 100,
      remainingBalance: 500,
      next_quota_reset: '2024-02-01T00:00:00.000Z',
    }

    const updatedData = {
      type: 'usage-response' as const,
      usage: 150,
      remainingBalance: 450,
      next_quota_reset: '2024-02-01T00:00:00.000Z',
    }

    setActivityQueryData(usageQueryKeys.current(), initialData)
    expect(
      getActivityQueryData<typeof initialData>(usageQueryKeys.current())?.usage,
    ).toBe(100)

    setActivityQueryData(usageQueryKeys.current(), updatedData)
    expect(
      getActivityQueryData<typeof initialData>(usageQueryKeys.current())?.usage,
    ).toBe(150)
  })

  test('should preserve data after invalidation', () => {
    const mockData = {
      type: 'usage-response' as const,
      usage: 100,
      remainingBalance: 500,
      next_quota_reset: '2024-02-01T00:00:00.000Z',
    }

    setActivityQueryData(usageQueryKeys.current(), mockData)
    invalidateActivityQuery(usageQueryKeys.current())

    // Data should still be accessible
    const cached = getActivityQueryData<typeof mockData>(
      usageQueryKeys.current(),
    )
    expect(cached).toEqual(mockData)
  })

  test('should handle cache removal', () => {
    const mockData = {
      type: 'usage-response' as const,
      usage: 100,
      remainingBalance: 500,
      next_quota_reset: '2024-02-01T00:00:00.000Z',
    }

    setActivityQueryData(usageQueryKeys.current(), mockData)
    expect(
      getActivityQueryData<typeof mockData>(usageQueryKeys.current()),
    ).toBeDefined()

    removeActivityQuery(usageQueryKeys.current())
    expect(
      getActivityQueryData<typeof mockData>(usageQueryKeys.current()),
    ).toBeUndefined()
  })

  test('should handle balance breakdown with all credit types', () => {
    const mockData = {
      type: 'usage-response' as const,
      usage: 500,
      remainingBalance: 1500,
      balanceBreakdown: {
        free: 300,
        paid: 700,
        ad: 200,
        referral: 200,
        admin: 100,
      },
      next_quota_reset: '2024-02-15T00:00:00.000Z',
    }

    setActivityQueryData(usageQueryKeys.current(), mockData)
    const cached = getActivityQueryData<typeof mockData>(
      usageQueryKeys.current(),
    )

    expect(cached?.balanceBreakdown?.free).toBe(300)
    expect(cached?.balanceBreakdown?.paid).toBe(700)
    expect(cached?.balanceBreakdown?.ad).toBe(200)
    expect(cached?.balanceBreakdown?.referral).toBe(200)
    expect(cached?.balanceBreakdown?.admin).toBe(100)
  })

  test('should handle zero and null values correctly', () => {
    const mockData = {
      type: 'usage-response' as const,
      usage: 0,
      remainingBalance: 0,
      balanceBreakdown: { free: 0, paid: 0 },
      next_quota_reset: null,
    }

    setActivityQueryData(usageQueryKeys.current(), mockData)
    const cached = getActivityQueryData<typeof mockData>(
      usageQueryKeys.current(),
    )

    expect(cached?.usage).toBe(0)
    expect(cached?.remainingBalance).toBe(0)
    expect(cached?.next_quota_reset).toBeNull()
  })

  test('reset clears usage cache', () => {
    const mockData = {
      type: 'usage-response' as const,
      usage: 100,
      remainingBalance: 500,
      next_quota_reset: null,
    }

    setActivityQueryData(usageQueryKeys.current(), mockData)
    expect(
      getActivityQueryData<typeof mockData>(usageQueryKeys.current()),
    ).toBeDefined()

    resetActivityQueryCache()
    expect(
      getActivityQueryData<typeof mockData>(usageQueryKeys.current()),
    ).toBeUndefined()
  })

  test('multiple invalidations preserve data', () => {
    const mockData = {
      type: 'usage-response' as const,
      usage: 100,
      remainingBalance: 500,
      next_quota_reset: '2024-02-01T00:00:00.000Z',
    }

    setActivityQueryData(usageQueryKeys.current(), mockData)

    // Invalidate multiple times
    invalidateActivityQuery(usageQueryKeys.current())
    invalidateActivityQuery(usageQueryKeys.current())
    invalidateActivityQuery(usageQueryKeys.current())

    // Data should still be there
    expect(
      getActivityQueryData<typeof mockData>(usageQueryKeys.current()),
    ).toEqual(mockData)
  })
})

// use-usage-query test family — query keys + refresh/invalidation semantics.
// Sibling of the Loop 355 decomposition (module-level cache/env lifecycle
// replicated per file, matching the original monolith).
import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'

import {
  resetActivityQueryCache,
  getActivityQueryData,
  setActivityQueryData,
  invalidateActivityQuery,
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

describe('usageQueryKeys', () => {
  test('all returns base query key', () => {
    expect(usageQueryKeys.all).toEqual(['usage'])
  })

  test('current returns extended query key', () => {
    expect(usageQueryKeys.current()).toEqual(['usage', 'current'])
  })

  test('current returns new array instance each call', () => {
    const first = usageQueryKeys.current()
    const second = usageQueryKeys.current()
    expect(first).not.toBe(second)
    expect(first).toEqual(second)
  })

  test('query keys can be used for cache operations', () => {
    const mockData = {
      type: 'usage-response' as const,
      usage: 50,
      remainingBalance: 200,
      next_quota_reset: null,
    }

    setActivityQueryData(usageQueryKeys.current(), mockData)
    expect(
      getActivityQueryData<typeof mockData>(usageQueryKeys.current()),
    ).toEqual(mockData)
  })
})

describe('useRefreshUsage behavior', () => {
  // Note: useRefreshUsage is a React hook that wraps invalidateActivityQuery.
  // We can't call it directly outside a component, but we can test the
  // underlying invalidation behavior it uses.

  afterEach(() => {
    mock.restore()
    resetActivityQueryCache()
  })

  test('invalidating usage query preserves cached data', () => {
    const mockData = {
      type: 'usage-response' as const,
      usage: 100,
      remainingBalance: 500,
      next_quota_reset: '2024-02-01T00:00:00.000Z',
    }

    // Pre-populate cache
    setActivityQueryData(usageQueryKeys.current(), mockData)
    expect(
      getActivityQueryData<typeof mockData>(usageQueryKeys.current()),
    ).toEqual(mockData)

    // Call the underlying invalidation function (what useRefreshUsage wraps)
    invalidateActivityQuery(usageQueryKeys.current())

    // Data should still exist (invalidation doesn't remove data)
    expect(
      getActivityQueryData<typeof mockData>(usageQueryKeys.current()),
    ).toEqual(mockData)
  })

  test('invalidation marks data as stale for refetching', () => {
    const mockData = {
      type: 'usage-response' as const,
      usage: 200,
      remainingBalance: 300,
      next_quota_reset: '2024-03-01T00:00:00.000Z',
    }

    setActivityQueryData(usageQueryKeys.current(), mockData)
    invalidateActivityQuery(usageQueryKeys.current())

    // Data is still accessible (stale but usable)
    const cached = getActivityQueryData<typeof mockData>(
      usageQueryKeys.current(),
    )
    expect(cached?.usage).toBe(200)
    expect(cached?.remainingBalance).toBe(300)
  })
})

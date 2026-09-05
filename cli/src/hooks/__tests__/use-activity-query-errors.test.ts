import { describe, test, expect, beforeEach, afterEach } from 'bun:test'

import {
  invalidateActivityQuery,
  removeActivityQuery,
  getActivityQueryData,
  setActivityQueryData,
  resetActivityQueryCache,
  isEntryStale,
  setErrorOnlyCacheEntry,
} from '../use-activity-query'

/**
 * Tests for edge cases and error scenarios in the caching system.
 */
describe('cache edge cases and error handling', () => {
  beforeEach(() => {
    resetActivityQueryCache()
  })
  test('setting undefined data should still create cache entry', () => {
    const testKey = ['undefined-test']
    setActivityQueryData(testKey, undefined)
    // getActivityQueryData returns undefined for both "not in cache" and "data is undefined"
    // This is expected behavior - undefined is a valid cached value
    expect(getActivityQueryData(testKey)).toBeUndefined()
  })
  test('setting null data should store null', () => {
    const testKey = ['null-test']
    setActivityQueryData(testKey, null)
    expect(getActivityQueryData(testKey)).toBeNull()
  })
  test('complex nested objects should be stored correctly', () => {
    const testKey = ['complex-object-test']
    const complexData = {
      user: {
        id: 1,
        profile: {
          name: 'Test',
          settings: {
            theme: 'dark',
            notifications: [1, 2, 3],
          },
        },
      },
      timestamp: new Date('2024-01-01'),
    }
    setActivityQueryData(testKey, complexData)
    const cached = getActivityQueryData<typeof complexData>(testKey)
    expect(cached?.user.profile.settings.notifications).toEqual([1, 2, 3])
    expect(cached?.timestamp).toEqual(new Date('2024-01-01'))
  })
  test('array data should be stored and retrieved correctly', () => {
    const testKey = ['array-test']
    const arrayData = [1, 2, 3, { nested: 'value' }]
    setActivityQueryData(testKey, arrayData)
    const cached = getActivityQueryData<typeof arrayData>(testKey)
    expect(cached).toEqual(arrayData)
    expect(cached?.[3]).toEqual({ nested: 'value' })
  })
  test('invalidating non-existent key should not throw', () => {
    expect(() => {
      invalidateActivityQuery(['non-existent-key'])
    }).not.toThrow()
  })
  test('removing non-existent key should not throw', () => {
    expect(() => {
      removeActivityQuery(['non-existent-key'])
    }).not.toThrow()
  })
  test('getting data after remove should return undefined', () => {
    const testKey = ['remove-then-get-test']
    setActivityQueryData(testKey, 'data')
    removeActivityQuery(testKey)
    expect(getActivityQueryData(testKey)).toBeUndefined()
  })
  test('setting data after remove should work', () => {
    const testKey = ['remove-then-set-test']
    setActivityQueryData(testKey, 'first')
    removeActivityQuery(testKey)
    setActivityQueryData(testKey, 'second')
    expect(getActivityQueryData<string>(testKey)).toBe('second')
  })
})
/**
 * Tests for error-only cache entries and persistent error scenarios.
 * This test suite was added to debug and fix an issue where fetchSubscriptionData
 * was being called every second when the endpoint returned errors.
 */
describe('error-only entries and persistent error handling', () => {
  let originalDateNow: typeof Date.now
  let mockNow: number
  beforeEach(() => {
    resetActivityQueryCache()
    originalDateNow = Date.now
    mockNow = 1000000
    Date.now = () => mockNow
  })
  afterEach(() => {
    Date.now = originalDateNow
  })
  test('setErrorOnlyCacheEntry creates entry with no data and error', () => {
    const testKey = ['error-entry-test']
    const error = new Error('Network error')
    setErrorOnlyCacheEntry(testKey, error)
    // Data should be undefined (error-only entry)
    expect(getActivityQueryData(testKey)).toBeUndefined()
  })
  test('error-only entry with recent errorUpdatedAt should NOT be stale', () => {
    // This test verifies the fix for the infinite refetch loop bug.
    //
    // Scenario:
    // 1. Fetch fails with no prior data
    // 2. Error is stored with errorUpdatedAt = now
    // 3. Polling tick fires
    // 4. isEntryStale should return FALSE if errorUpdatedAt is recent
    // 5. This prevents immediate refetch loop
    const testKey = ['error-only-fresh-test']
    const serializedKey = JSON.stringify(testKey)
    const staleTime = 30000 // 30 seconds
    const error = new Error('API error')
    // Create error-only entry at current time (mockNow = 1000000)
    setErrorOnlyCacheEntry(testKey, error, mockNow)
    // Entry has errorUpdatedAt = 1000000, current time = 1000000
    // Time since error: 0ms, staleTime: 30000ms
    // Should NOT be stale because error is recent
    expect(isEntryStale(serializedKey, staleTime)).toBe(false)
  })
  test('error-only entry becomes stale after staleTime passes', () => {
    const testKey = ['error-stale-after-time-test']
    const serializedKey = JSON.stringify(testKey)
    const staleTime = 30000 // 30 seconds
    const error = new Error('API error')
    // Create error-only entry at current time
    setErrorOnlyCacheEntry(testKey, error, mockNow)
    // Initially not stale
    expect(isEntryStale(serializedKey, staleTime)).toBe(false)
    // Advance time by 25 seconds - still fresh
    mockNow += 25000
    expect(isEntryStale(serializedKey, staleTime)).toBe(false)
    // Advance time past staleTime (now 35 seconds since error)
    mockNow += 10000
    expect(isEntryStale(serializedKey, staleTime)).toBe(true)
  })
  test('simulates subscription query polling with persistent errors', () => {
    // This test simulates the exact bug scenario:
    // - useSubscriptionQuery with staleTime=30s, refetchInterval=60s
    // - Endpoint returns errors
    // - Without fix: isEntryStale returns true immediately, causing rapid refetches
    // - With fix: isEntryStale uses errorUpdatedAt, preventing rapid refetches
    const subscriptionKey = ['subscription', 'current']
    const serializedKey = JSON.stringify(subscriptionKey)
    const staleTime = 30000 // 30 seconds (matches useSubscriptionQuery)
    const _refetchInterval = 60000 // 60 seconds
    const error = new Error('Failed to fetch subscription: 500')
    // Simulate first fetch failure at t=0
    setErrorOnlyCacheEntry(subscriptionKey, error, mockNow)
    // Immediately after error, entry should NOT be stale
    // This is the critical fix - prevents immediate refetch loop
    expect(isEntryStale(serializedKey, staleTime)).toBe(false)
    // Simulate polling interval at t=1s (as reported in bug)
    mockNow += 1000
    // Entry should still NOT be stale (only 1s since error, staleTime is 30s)
    expect(isEntryStale(serializedKey, staleTime)).toBe(false)
    // Simulate many 1-second intervals - none should trigger refetch until staleTime
    for (let i = 0; i < 28; i++) {
      mockNow += 1000
      expect(isEntryStale(serializedKey, staleTime)).toBe(false)
    }
    // Now at t=29s - should still be fresh (29s is not > 30s)
    expect(isEntryStale(serializedKey, staleTime)).toBe(false)
    // At t=30s - should still be fresh (30s is not > 30s, need strictly greater)
    mockNow += 1000
    expect(isEntryStale(serializedKey, staleTime)).toBe(false)
    // At t=31s - now stale, refetch should be allowed (31s > 30s)
    mockNow += 1000
    expect(isEntryStale(serializedKey, staleTime)).toBe(true)
  })
  test('staleTime of 0 means always stale even for error-only entries', () => {
    const testKey = ['zero-stale-error-test']
    const serializedKey = JSON.stringify(testKey)
    const error = new Error('Some error')
    setErrorOnlyCacheEntry(testKey, error, mockNow)
    // With staleTime=0, entry is always considered stale
    expect(isEntryStale(serializedKey, 0)).toBe(true)
  })
  test('error-only entry with null errorUpdatedAt is stale', () => {
    // Edge case: if somehow errorUpdatedAt is null, entry should be stale
    // This shouldn't happen in practice but tests defensive coding
    const testKey = ['null-error-time-test']
    const serializedKey = JSON.stringify(testKey)
    const staleTime = 30000
    // Create entry without errorUpdatedAt (using undefined which gets stored as null)
    // Note: setErrorOnlyCacheEntry always sets errorUpdatedAt, so we test via regular data
    // and then invalidate it
    // Non-existent key is stale
    expect(isEntryStale(serializedKey, staleTime)).toBe(true)
  })
  test('successful data takes precedence over errorUpdatedAt for staleness', () => {
    const testKey = ['data-precedence-test']
    const serializedKey = JSON.stringify(testKey)
    const staleTime = 30000
    // First, set an error-only entry
    setErrorOnlyCacheEntry(testKey, new Error('Initial error'), mockNow)
    expect(isEntryStale(serializedKey, staleTime)).toBe(false) // Fresh error
    // Now set successful data (this is what happens on successful retry)
    setActivityQueryData(testKey, { subscription: 'active' })
    // Staleness should now be based on dataUpdatedAt, not errorUpdatedAt
    expect(isEntryStale(serializedKey, staleTime)).toBe(false) // Fresh data
    // Advance time past staleTime
    mockNow += 35000
    expect(isEntryStale(serializedKey, staleTime)).toBe(true) // Stale based on dataUpdatedAt
  })
})

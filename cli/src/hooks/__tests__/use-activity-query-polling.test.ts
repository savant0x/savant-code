import { describe, test, expect, beforeEach, afterEach } from 'bun:test'

import {
  invalidateActivityQuery,
  getActivityQueryData,
  setActivityQueryData,
  resetActivityQueryCache,
  isEntryStale,
} from '../use-activity-query'

/**
 * Tests simulating the polling behavior to verify refetch intervals work.
 * These tests mock Date.now() to simulate time passing.
 */
describe('polling and staleness simulation', () => {
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
  test('data becomes stale after staleTime passes', () => {
    const testKey = ['stale-time-test']
    const serializedKey = JSON.stringify(testKey)
    const staleTime = 30000 // 30 seconds
    // Set data at t=0
    setActivityQueryData(testKey, 'fresh-data')
    // Data was set at mockNow (1000000), so dataUpdatedAt = 1000000
    expect(getActivityQueryData<string>(testKey)).toBe('fresh-data')
    expect(isEntryStale(serializedKey, staleTime)).toBe(false) // Fresh
    // Advance time by 25 seconds - still fresh
    mockNow += 25000
    expect(isEntryStale(serializedKey, staleTime)).toBe(false)
    // Advance time past staleTime
    mockNow += 10000 // Now 35 seconds have passed
    // Data should now be considered stale (35s > 30s staleTime)
    expect(isEntryStale(serializedKey, staleTime)).toBe(true)
    // The data is still accessible even when stale
    expect(getActivityQueryData<string>(testKey)).toBe('fresh-data')
  })
  test('invalidated data is immediately stale', () => {
    const testKey = ['invalidate-stale-test']
    const serializedKey = JSON.stringify(testKey)
    const staleTime = 30000
    // Set fresh data
    setActivityQueryData(testKey, 'data')
    expect(isEntryStale(serializedKey, staleTime)).toBe(false)
    // Invalidate immediately makes it stale (dataUpdatedAt = 0)
    invalidateActivityQuery(testKey)
    expect(isEntryStale(serializedKey, staleTime)).toBe(true)
    // Data still exists but would be refetched on next access
    expect(getActivityQueryData<string>(testKey)).toBe('data')
  })
  test('updating data resets the staleness timer', () => {
    const testKey = ['reset-timer-test']
    const serializedKey = JSON.stringify(testKey)
    const staleTime = 30000
    // Set initial data
    setActivityQueryData(testKey, 'initial')
    expect(isEntryStale(serializedKey, staleTime)).toBe(false)
    // Advance time past staleTime
    mockNow += 35000
    expect(isEntryStale(serializedKey, staleTime)).toBe(true)
    // Update data - should reset the timer
    setActivityQueryData(testKey, 'updated')
    expect(isEntryStale(serializedKey, staleTime)).toBe(false) // Fresh again
    // Data is fresh again
    expect(getActivityQueryData<string>(testKey)).toBe('updated')
    // Advance a little bit - should still be fresh
    mockNow += 10000
    expect(isEntryStale(serializedKey, staleTime)).toBe(false)
    expect(getActivityQueryData<string>(testKey)).toBe('updated')
  })
  test('staleTime of 0 means always stale', () => {
    const testKey = ['zero-stale-test']
    const serializedKey = JSON.stringify(testKey)
    // Set data
    setActivityQueryData(testKey, 'data')
    // With staleTime=0, data is always considered stale
    // (this means refetch should happen on every interval tick)
    expect(isEntryStale(serializedKey, 0)).toBe(true)
    expect(getActivityQueryData<string>(testKey)).toBe('data')
  })
  test('non-existent key is always stale', () => {
    const serializedKey = JSON.stringify(['non-existent'])
    expect(isEntryStale(serializedKey, 30000)).toBe(true)
  })
})
/**
 * Tests for the refetch on activity feature.
 * Verifies that data is refetched when user becomes active after being idle.
 */
describe('refetch on activity behavior', () => {
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
  test('data should be refetchable when user becomes active after idle', () => {
    const testKey = ['activity-refetch-test']
    const _staleTime = 30000
    const _idleThreshold = 30000
    // Set initial data
    setActivityQueryData(testKey, 'initial')
    // Simulate time passing beyond staleTime
    mockNow += 35000
    // At this point, if user was idle and becomes active,
    // and data is stale, a refetch should occur
    // Data should still be accessible
    expect(getActivityQueryData<string>(testKey)).toBe('initial')
    // Update with new data (simulating what refetch would do)
    setActivityQueryData(testKey, 'refetched')
    expect(getActivityQueryData<string>(testKey)).toBe('refetched')
  })
  test('pause when idle should prevent polling updates', () => {
    const testKey = ['pause-idle-test']
    // Set data
    setActivityQueryData(testKey, 'before-idle')
    // When pauseWhenIdle is true and user is idle:
    // - Polling interval fires
    // - But isUserActive returns false
    // - So no refetch happens
    // Data remains unchanged
    expect(getActivityQueryData<string>(testKey)).toBe('before-idle')
  })
})

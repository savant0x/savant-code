import { describe, test, expect, beforeEach } from 'bun:test'

import {
  getActivityQueryData,
  resetActivityQueryCache,
  isEntryStale,
  _retryTestHelpers,
} from '../use-activity-query'

/**
 * Tests for the retry infinite loop bug.
 *
 * BUG: When useSubscriptionQuery fetched /api/user/subscription and got a 401,
 * it would retry every ~1 second infinitely instead of respecting retry:1.
 *
 * ROOT CAUSE: In doFetch's catch block, when scheduling a retry:
 *   1. retryCounts.set(key, next)   // Sets count to 1
 *   2. clearRetryState(key)          // Deletes retryCounts → count back to 0!
 *   3. setTimeout to retry in 1s
 * When the retry fires, currentRetries reads as 0 again → thinks it still has
 * retries left → schedules another retry → infinite loop.
 *
 * FIX: Split clearRetryState into clearRetryTimeout (only clears timeout)
 * and clearRetryState (clears both). The retry scheduling block now uses
 * clearRetryTimeout so the retry count is preserved.
 */
describe('retry infinite loop bug fix (subscription 401 scenario)', () => {
  beforeEach(() => {
    resetActivityQueryCache()
  })
  test('retry count is preserved after scheduling a retry', () => {
    const queryKey = ['subscription', 'current']
    const maxRetries = 1
    // Simulate a mounted component (refCount > 0)
    _retryTestHelpers.setRefCount(queryKey, 1)
    // Initially, no retries have been attempted
    expect(_retryTestHelpers.getRetryCount(queryKey)).toBe(0)
    // First fetch fails → should schedule a retry
    const result1 = _retryTestHelpers.simulateFailedFetch(queryKey, maxRetries)
    expect(result1.retryScheduled).toBe(true)
    expect(result1.retryCount).toBe(1)
    // CRITICAL: Retry count must be preserved (not reset to 0)
    expect(_retryTestHelpers.getRetryCount(queryKey)).toBe(1)
  })
  test('retries are exhausted after maxRetries attempts', () => {
    const queryKey = ['subscription', 'current']
    const maxRetries = 1
    _retryTestHelpers.setRefCount(queryKey, 1)
    // First fetch fails → retry scheduled (count becomes 1)
    const result1 = _retryTestHelpers.simulateFailedFetch(queryKey, maxRetries)
    expect(result1.retryScheduled).toBe(true)
    expect(result1.retryCount).toBe(1)
    // Retry fires, also fails → retries exhausted (count = 1, not < maxRetries=1)
    const result2 = _retryTestHelpers.simulateFailedFetch(queryKey, maxRetries)
    expect(result2.retryScheduled).toBe(false)
    expect(result2.retryCount).toBe(0) // Reset after exhaustion
  })
  test('simulates full subscription 401 scenario: fetch + 1 retry + stop', () => {
    // This reproduces the exact bug scenario:
    // useSubscriptionQuery with retry:1 hitting a 401 on /api/user/subscription
    const queryKey = ['subscription', 'current']
    const maxRetries = 1
    // Component is mounted
    _retryTestHelpers.setRefCount(queryKey, 1)
    // === Fetch #1: Initial fetch fails with 401 ===
    const fetch1 = _retryTestHelpers.simulateFailedFetch(queryKey, maxRetries)
    expect(fetch1.retryScheduled).toBe(true)
    expect(fetch1.retryCount).toBe(1)
    // === Fetch #2: Retry fires after 1s, also fails with 401 ===
    const fetch2 = _retryTestHelpers.simulateFailedFetch(queryKey, maxRetries)
    expect(fetch2.retryScheduled).toBe(false) // Retries exhausted!
    expect(fetch2.retryCount).toBe(0)
    // === Fetch #3: If the bug existed, this would schedule ANOTHER retry ===
    // With the fix, the error is stored and no more retries are scheduled.
    // A third call should also exhaust immediately since count was reset to 0
    // BUT there's no retry scheduled, so this would only happen from polling.
    const fetch3 = _retryTestHelpers.simulateFailedFetch(queryKey, maxRetries)
    // Even if polling triggers another fetch, retry:1 means ONE retry per fetch cycle
    expect(fetch3.retryScheduled).toBe(true) // New fetch cycle starts fresh
    expect(fetch3.retryCount).toBe(1)
    // The retry for fetch3 fires and fails
    const fetch4 = _retryTestHelpers.simulateFailedFetch(queryKey, maxRetries)
    expect(fetch4.retryScheduled).toBe(false) // Exhausted again
  })
  test('demonstrates the old bug: clearRetryState would reset count causing infinite loop', () => {
    // This test documents the OLD buggy behavior.
    // The old code called clearRetryState (which deletes retryCounts) right after
    // setting the retry count, effectively resetting it to 0 every time.
    const queryKey = ['subscription', 'current']
    _retryTestHelpers.setRefCount(queryKey, 1)
    // Step 1: Simulate first fetch failure setting retry count to 1
    _retryTestHelpers.setRetryCount(queryKey, 1)
    expect(_retryTestHelpers.getRetryCount(queryKey)).toBe(1)
    // Step 2: OLD CODE would call clearRetryState here, which resets count to 0:
    // clearRetryState(key) → retryCounts.delete(key) → count = 0
    // Simulate the old bug by manually resetting:
    _retryTestHelpers.setRetryCount(queryKey, 0)
    expect(_retryTestHelpers.getRetryCount(queryKey)).toBe(0)
    // Step 3: When the retry fires after 1s, it reads count as 0
    // 0 < maxRetries(1) → true → schedules ANOTHER retry (should have been false!)
    const result = _retryTestHelpers.simulateFailedFetch(queryKey, 1)
    expect(result.retryScheduled).toBe(true) // BUG: should have been false!
    expect(result.retryCount).toBe(1) // Count set to 1 again...
    // And the cycle repeats: count gets reset → retry fires → count is 0 → retry...
    // With the fix (clearRetryTimeout instead of clearRetryState), count stays at 1
    // so the next attempt correctly sees 1 >= maxRetries(1) → exhausted.
  })
  test('retry count resets to 0 when retries are exhausted', () => {
    const queryKey = ['retry-reset-test']
    const maxRetries = 2
    _retryTestHelpers.setRefCount(queryKey, 1)
    // First fail → retry scheduled, count=1
    const r1 = _retryTestHelpers.simulateFailedFetch(queryKey, maxRetries)
    expect(r1).toEqual({ retryScheduled: true, retryCount: 1 })
    // Second fail → retry scheduled, count=2
    const r2 = _retryTestHelpers.simulateFailedFetch(queryKey, maxRetries)
    expect(r2).toEqual({ retryScheduled: true, retryCount: 2 })
    // Third fail → retries exhausted, count reset to 0
    const r3 = _retryTestHelpers.simulateFailedFetch(queryKey, maxRetries)
    expect(r3).toEqual({ retryScheduled: false, retryCount: 0 })
  })
  test('no retries when retry is 0 or false', () => {
    const queryKey = ['no-retry-test']
    _retryTestHelpers.setRefCount(queryKey, 1)
    // retry: 0 (equivalent to retry: false)
    const result = _retryTestHelpers.simulateFailedFetch(queryKey, 0)
    expect(result.retryScheduled).toBe(false)
    expect(result.retryCount).toBe(0)
  })
  test('no retries when component is unmounted (refCount=0)', () => {
    const queryKey = ['unmounted-test']
    // Don't set refCount (defaults to 0 = no mounted components)
    const result = _retryTestHelpers.simulateFailedFetch(queryKey, 1)
    expect(result.retryScheduled).toBe(false)
  })
  test('error-only entry is created after retries exhausted', () => {
    const queryKey = ['error-entry-after-retry']
    _retryTestHelpers.setRefCount(queryKey, 1)
    // First fail → retry
    _retryTestHelpers.simulateFailedFetch(queryKey, 1)
    // No cache entry yet during retry phase
    expect(getActivityQueryData(queryKey)).toBeUndefined()
    // Second fail → exhausted, error entry created
    _retryTestHelpers.simulateFailedFetch(queryKey, 1)
    // Error entry should exist (data is undefined but entry exists)
    // The entry has error set, which we can verify via isEntryStale behavior
    const serializedKey = JSON.stringify(queryKey)
    // Entry exists (not stale due to "no entry" - stale due to other reasons)
    // Since we just set errorUpdatedAt = Date.now(), it should not be stale
    // for a reasonable staleTime
    expect(isEntryStale(serializedKey, 30000)).toBe(false)
  })
})

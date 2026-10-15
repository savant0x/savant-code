import {
  clearRetryTimeout,
  getCacheEntry,
  getRefCountsMap,
  inFlight,
  retryCounts,
  retryTimeouts,
  serializeQueryKey,
  setCacheEntry,
  setQueryFetching,
} from './cache'

/**
 * Test helpers for verifying retry behavior.
 * These expose internal retry state to allow unit testing the retry logic
 * without needing a React renderer. Kept separate from the cache module so
 * both stay under the line bar (FID-2026-0805-003). They read/write the same
 * module state the runtime uses (exported from cache.ts).
 */
export const _retryTestHelpers = {
  getRetryCount(queryKey: readonly unknown[]): number {
    return retryCounts.get(serializeQueryKey(queryKey)) ?? 0
  },
  setRetryCount(queryKey: readonly unknown[], count: number): void {
    retryCounts.set(serializeQueryKey(queryKey), count)
  },
  getRetryTimeout(
    queryKey: readonly unknown[],
  ): ReturnType<typeof setTimeout> | undefined {
    return retryTimeouts.get(serializeQueryKey(queryKey))
  },
  setRefCount(queryKey: readonly unknown[], count: number): void {
    const key = serializeQueryKey(queryKey)
    const refCounts = getRefCountsMap()
    if (count === 0) refCounts.delete(key)
    else refCounts.set(key, count)
  },
  setFetching(queryKey: readonly unknown[], fetching: boolean): void {
    setQueryFetching(serializeQueryKey(queryKey), fetching)
  },
  getInFlight(queryKey: readonly unknown[]): boolean {
    return inFlight.has(serializeQueryKey(queryKey))
  },
  /**
   * Simulate the exact retry scheduling logic from runQuery's catch block.
   * This reproduces the code path that caused the infinite retry loop bug.
   * Returns whether a retry was scheduled (true) or retries were exhausted (false).
   */
  simulateFailedFetch(
    queryKey: readonly unknown[],
    maxRetries: number,
  ): { retryScheduled: boolean; retryCount: number } {
    const key = serializeQueryKey(queryKey)
    const refCounts = getRefCountsMap()
    const currentRetries = retryCounts.get(key) ?? 0

    if (currentRetries < maxRetries && (refCounts.get(key) ?? 0) > 0) {
      const next = currentRetries + 1
      retryCounts.set(key, next)

      inFlight.delete(key)
      setQueryFetching(key, false)

      // This is the fixed line — uses clearRetryTimeout instead of clearRetryState
      clearRetryTimeout(key)

      // Don't actually schedule a setTimeout in tests, just record the intent
      return { retryScheduled: true, retryCount: next }
    }

    retryCounts.set(key, 0)

    const existingEntry = getCacheEntry(key)
    setCacheEntry(key, {
      data: existingEntry?.data,
      dataUpdatedAt: existingEntry?.dataUpdatedAt ?? 0,
      error: new Error('Simulated fetch error'),
      errorUpdatedAt: Date.now(),
    })

    inFlight.delete(key)
    setQueryFetching(key, false)

    return { retryScheduled: false, retryCount: 0 }
  },
}

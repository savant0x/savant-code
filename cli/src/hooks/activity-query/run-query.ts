import {
  clearRetryState,
  clearRetryTimeout,
  getCacheEntry,
  getGeneration,
  getRefCount,
  inFlight,
  retryCounts,
  retryTimeouts,
  setCacheEntry,
  setQueryFetching,
} from './cache'

export type RunQueryParams = {
  serializedKey: string
  /** Reads the current queryFn (a ref accessor) so late retries see the latest fn. */
  queryFn: () => Promise<unknown>
  enabled: boolean
  retry: number | false
}

/**
 * Runs a query with global dedup, error retry scheduling, and cache writes.
 * Moved from the hook's doFetch (FID-2026-0805-003); the retry recursion stays
 * internal so the retry/GC state is owned by the cache module.
 */
export async function runQuery(params: RunQueryParams): Promise<void> {
  const { serializedKey: key, queryFn, enabled, retry } = params
  if (!enabled) return

  // global dedupe
  const existing = inFlight.get(key)
  if (existing) {
    await existing
    return
  }

  const myGen = getGeneration(key)
  setQueryFetching(key, true)

  const fetchPromise = (async () => {
    try {
      // Use the accessor to get latest queryFn without including it in dependencies
      const result = await queryFn()

      // If someone removed/GC'd this key while we were in-flight, don’t resurrect it.
      if (getGeneration(key) !== myGen) return

      setCacheEntry(key, {
        data: result,
        dataUpdatedAt: Date.now(),
        error: null,
        errorUpdatedAt: null,
      })
      retryCounts.set(key, 0)
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err))
      const maxRetries = retry === false ? 0 : retry
      const currentRetries = retryCounts.get(key) ?? 0

      if (currentRetries < maxRetries && getRefCount(key) > 0) {
        const next = currentRetries + 1
        retryCounts.set(key, next)

        // allow a new in-flight request for the retry attempt
        inFlight.delete(key)
        setQueryFetching(key, false)

        // Only clear the previous timeout, NOT the retry count.
        // Using clearRetryState here would reset retryCounts, causing infinite retries.
        // (see: _retryTestHelpers.simulateFailedFetch mirrors this logic)
        clearRetryTimeout(key)
        const t = setTimeout(() => {
          retryTimeouts.delete(key)
          // only retry if still mounted somewhere and key not deleted
          if (getRefCount(key) > 0 && getGeneration(key) === myGen) {
            void runQuery(params)
          }
        }, 1000 * next)
        retryTimeouts.set(key, t)
        return
      }

      retryCounts.set(key, 0)

      // Store error even if we have no existing data (error-only entry).
      if (getGeneration(key) !== myGen) return

      const existingEntry = getCacheEntry(key)
      setCacheEntry(key, {
        data: existingEntry?.data,
        dataUpdatedAt: existingEntry?.dataUpdatedAt ?? 0,
        error: e,
        errorUpdatedAt: Date.now(),
      })
    } finally {
      inFlight.delete(key)
      setQueryFetching(key, false)

      // If nobody is watching and the entry was deleted, keep things tidy.
      if (getRefCount(key) === 0) {
        clearRetryState(key)
      }
    }
  })()

  inFlight.set(key, fetchPromise)
  await fetchPromise
}

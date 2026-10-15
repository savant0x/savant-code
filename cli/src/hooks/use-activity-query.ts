import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

import { isUserActive, subscribeToActivity } from '../utils/activity-tracker'
import {
  cancelPendingGc,
  clearRetryState,
  decrementRefCount,
  deleteCacheEntry,
  getCacheEntry,
  getKeySnapshot,
  getRefCount,
  incrementRefCount,
  invalidateActivityQuery,
  isEntryStale,
  scheduleGc,
  serializeQueryKey,
  subscribeToKey,
} from './activity-query/cache'
import { runQuery } from './activity-query/run-query'

// Public API re-exports — the cache layer + imperative API moved to
// activity-query/cache.ts (FID-2026-0805-003); consumers keep importing from
// this path unchanged.
export { _retryTestHelpers } from './activity-query/retry-test-helpers'
export {
  getActivityQueryData,
  invalidateActivityQuery,
  isEntryStale,
  removeActivityQuery,
  resetActivityQueryCache,
  setActivityQueryData,
  setErrorOnlyCacheEntry,
} from './activity-query/cache'

export type UseActivityQueryOptions<T> = {
  /** Unique key for caching the query */
  queryKey: readonly unknown[]
  /** Function that fetches the data */
  queryFn: () => Promise<T>
  /** Whether the query is enabled (default: true) */
  enabled?: boolean
  /** Time in ms before data is considered stale (default: 0) */
  staleTime?: number
  /** Time in ms to keep unused cache entries (default: 5 minutes) */
  gcTime?: number
  /** Number of retry attempts on failure (default: 0) */
  retry?: number | false
  /** Interval in ms to refetch data (default: false/disabled) */
  refetchInterval?: number | false

  /** Refetch when component mounts (default: false) */
  refetchOnMount?: boolean | 'always'
  /** Refetch stale data when user becomes active after being idle (default: false) */
  refetchOnActivity?: boolean
  /** Pause polling when user is idle (default: false) */
  pauseWhenIdle?: boolean
  /** Time in ms to consider user idle (default: 30 seconds) */
  idleThreshold?: number
}

export type UseActivityQueryResult<T> = {
  /** The query data, undefined if not yet fetched */
  data: T | undefined
  /** Whether the initial fetch is in progress */
  isLoading: boolean
  /** Whether any fetch (initial or refetch) is in progress */
  isFetching: boolean
  /** Whether the query has successfully fetched data */
  isSuccess: boolean
  /** Error from the last fetch attempt */
  error: Error | null
  /** Manually trigger a refetch */
  refetch: () => Promise<void>
}

/**
 * Activity-aware query hook that provides caching and refetching based on user activity.
 *
 * This hook replaces TanStack Query with terminal-specific activity awareness:
 * - Detects when user is active (typing, mouse movement, keyboard shortcuts)
 * - Can pause polling when user is idle to save resources
 * - Can refetch stale data when user becomes active again
 */
export function useActivityQuery<T>(
  options: UseActivityQueryOptions<T>,
): UseActivityQueryResult<T> {
  const {
    queryKey,
    queryFn,
    enabled = true,
    staleTime = 0,
    gcTime = 5 * 60 * 1000,
    retry = 0,
    refetchInterval = false,
    refetchOnMount = false,
    refetchOnActivity = false,
    pauseWhenIdle = false,
    idleThreshold = 30_000,
  } = options

  const serializedKey = serializeQueryKey(queryKey)
  const mountedRef = useRef(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wasIdleRef = useRef(false)

  // Store queryFn in a ref to avoid recreating doFetch when queryFn changes.
  // This is critical because inline arrow functions create new references on every render,
  // which would cause the polling interval to reset constantly.
  const queryFnRef = useRef(queryFn)
  queryFnRef.current = queryFn

  // Snapshot includes entry + isFetching (so fetch-status updates rerender correctly)
  const snap = useSyncExternalStore(
    (cb) => subscribeToKey(serializedKey, cb),
    () => getKeySnapshot<T>(serializedKey),
    () => getKeySnapshot<T>(serializedKey),
  )

  const cachedEntry = snap.entry
  const isFetching = snap.isFetching

  const data = cachedEntry?.data
  const error = cachedEntry?.error ?? null
  const dataUpdatedAt = cachedEntry?.dataUpdatedAt ?? 0

  // Initial load = fetching with no successful data yet
  const isLoading = isFetching && (cachedEntry == null || dataUpdatedAt === 0)

  const doFetch = useCallback(async (): Promise<void> => {
    // Pass a ref accessor so late retries (scheduled by runQuery) read the
    // latest queryFn, matching the original in-closure ref behavior.
    await runQuery({
      serializedKey,
      queryFn: () => queryFnRef.current(),
      enabled,
      retry,
    })
  }, [enabled, serializedKey, retry])

  const refetch = useCallback(async (): Promise<void> => {
    clearRetryState(serializedKey)
    await doFetch()
  }, [doFetch, serializedKey])

  // Refcount + cancel pending GC when (re)subscribing
  useEffect(() => {
    cancelPendingGc(serializedKey)

    wasIdleRef.current = false
    incrementRefCount(serializedKey)

    return () => {
      const next = decrementRefCount(serializedKey)

      // If last observer is gone, don’t keep retry timers around.
      if (next === 0) {
        clearRetryState(serializedKey)
      }
    }
  }, [serializedKey])

  // Initial fetch on mount/key change/enabled toggle (intentionally minimal deps)
  useEffect(() => {
    mountedRef.current = true
    if (!enabled) return

    const currentEntry = getCacheEntry<T>(serializedKey)
    // Use isEntryStale for consistent staleness calculation that considers
    // both dataUpdatedAt and errorUpdatedAt (prevents rapid refetch loops
    // when endpoint returns persistent errors)
    const currentlyStale = isEntryStale(serializedKey, staleTime)

    const shouldFetchOnMount =
      refetchOnMount === 'always' ||
      (refetchOnMount && currentlyStale) ||
      !currentEntry

    if (shouldFetchOnMount) void doFetch()

    return () => {
      mountedRef.current = false
    }
  }, [enabled, serializedKey])

  // Polling
  useEffect(() => {
    if (!enabled || !refetchInterval) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const tick = () => {
      if (pauseWhenIdle && !isUserActive(idleThreshold)) {
        wasIdleRef.current = true
        return
      }
      if (isEntryStale(serializedKey, staleTime)) {
        void doFetch()
      }
    }

    intervalRef.current = setInterval(tick, refetchInterval)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [
    enabled,
    refetchInterval,
    pauseWhenIdle,
    idleThreshold,
    staleTime,
    serializedKey,
    doFetch,
  ])

  // Refetch on activity after idle
  useEffect(() => {
    if (!enabled || !refetchOnActivity) return

    const unsubscribe = subscribeToActivity(() => {
      if (wasIdleRef.current) {
        wasIdleRef.current = false
        if (isEntryStale(serializedKey, staleTime)) {
          void doFetch()
        }
      }
    })

    const checkIdle = setInterval(() => {
      if (!isUserActive(idleThreshold)) {
        wasIdleRef.current = true
      }
    }, 5000)

    return () => {
      unsubscribe()
      clearInterval(checkIdle)
    }
  }, [
    enabled,
    refetchOnActivity,
    idleThreshold,
    staleTime,
    serializedKey,
    doFetch,
  ])

  // Garbage collection
  useEffect(() => {
    return () => {
      const timeoutId = setTimeout(() => {
        if (getRefCount(serializedKey) === 0) {
          deleteCacheEntry(serializedKey)
          cancelPendingGc(serializedKey)
        }
      }, gcTime)

      scheduleGc(serializedKey, timeoutId)
    }
  }, [serializedKey, gcTime])

  return {
    data,
    isLoading,
    isFetching,
    isSuccess:
      cachedEntry != null &&
      cachedEntry.error == null &&
      cachedEntry.dataUpdatedAt !== 0,
    error,
    refetch,
  }
}

export function useInvalidateActivityQuery() {
  return useCallback((queryKey: readonly unknown[]) => {
    invalidateActivityQuery(queryKey)
  }, [])
}

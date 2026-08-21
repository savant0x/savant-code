import { bumpGeneration, clearRetryState, resetRetryState } from './retry-state'

export {
  clearRetryState,
  clearRetryTimeout,
  getGeneration,
  retryCounts,
  retryTimeouts,
} from './retry-state'

// Global query cache
type CacheEntry<T> = {
  // allow error-only entries (first fetch failure) without pretending data exists
  data?: T
  dataUpdatedAt: number // 0 means "no successful data yet" (also stale)
  error: Error | null
  errorUpdatedAt: number | null
}

type KeySnapshot<T> = {
  entry: CacheEntry<T> | undefined
  isFetching: boolean
}

type CacheState = {
  entries: Map<string, CacheEntry<unknown>>
  // Per-key listeners
  keyListeners: Map<string, Set<() => void>>
  // Reference counts
  refCounts: Map<string, number>
  // Global fetch status per key
  fetchingKeys: Set<string>
}

const cache: CacheState = {
  entries: new Map(),
  keyListeners: new Map(),
  refCounts: new Map(),
  fetchingKeys: new Set(),
}

// In-flight promises for request deduplication
// Exported so the test helpers (retry-test-helpers.ts) read/write the same
// state the runtime uses.
export const inFlight = new Map<string, Promise<unknown>>()

// Per-key snapshot memoization so fetching-status changes trigger rerenders
// even if the cache entry object didn’t change.
const snapshotMemo = new Map<
  string,
  {
    entryRef: CacheEntry<unknown> | undefined
    fetching: boolean
    snap: KeySnapshot<unknown>
  }
>()

/**
 * Notify listeners for a specific cache key.
 */
function notifyKeyListeners(key: string) {
  const listeners = cache.keyListeners.get(key)
  if (!listeners) return
  for (const listener of listeners) listener()
}

/**
 * Subscribe to cache changes for a specific key. Used by useSyncExternalStore.
 */
export function subscribeToKey(key: string, callback: () => void): () => void {
  let listeners = cache.keyListeners.get(key)
  if (!listeners) {
    listeners = new Set()
    cache.keyListeners.set(key, listeners)
  }
  listeners.add(callback)
  return () => {
    listeners!.delete(callback)
    if (listeners!.size === 0) {
      cache.keyListeners.delete(key)
    }
  }
}

/**
 * Snapshot includes BOTH entry + isFetching, and is memoized so Object.is only changes
 * when either changes. This fixes "notify but no rerender" when only fetch-status changes.
 */
export function getKeySnapshot<T>(key: string): KeySnapshot<T> {
  const entry = cache.entries.get(key) as CacheEntry<T> | undefined
  const fetching = cache.fetchingKeys.has(key)

  const memo = snapshotMemo.get(key)
  if (memo && memo.entryRef === entry && memo.fetching === fetching) {
    return memo.snap as KeySnapshot<T>
  }

  const snap: KeySnapshot<T> = { entry, isFetching: fetching }
  snapshotMemo.set(key, {
    entryRef: entry,
    fetching,
    snap: snap as KeySnapshot<unknown>,
  })
  return snap
}

export function setCacheEntry<T>(key: string, entry: CacheEntry<T>): void {
  cache.entries.set(key, entry as CacheEntry<unknown>)
  // bust memo for this key
  snapshotMemo.delete(key)
  notifyKeyListeners(key)
}

export function getCacheEntry<T>(key: string): CacheEntry<T> | undefined {
  return cache.entries.get(key) as CacheEntry<T> | undefined
}

/**
 * Check if a cache entry is stale based on staleTime.
 * Exported for testing purposes.
 */
export function isEntryStale(key: string, staleTime: number): boolean {
  const entry = getCacheEntry(key)
  if (!entry) return true

  // If we have successful data, use its timestamp for staleness
  if (entry.dataUpdatedAt !== 0) {
    return staleTime === 0 || Date.now() - entry.dataUpdatedAt > staleTime
  }

  // No successful data - check if we have a recent error
  // Use errorUpdatedAt to prevent rapid retries on persistent errors
  if (entry.errorUpdatedAt !== null) {
    return staleTime === 0 || Date.now() - entry.errorUpdatedAt > staleTime
  }

  // No data and no error timestamp - entry is stale
  return true
}

export function setQueryFetching(key: string, fetching: boolean): void {
  const wasFetching = cache.fetchingKeys.has(key)
  if (fetching) cache.fetchingKeys.add(key)
  else cache.fetchingKeys.delete(key)

  if (wasFetching !== fetching) {
    // bust memo so snapshot changes even if entry didn’t
    snapshotMemo.delete(key)
    notifyKeyListeners(key)
  }
}

export function incrementRefCount(key: string): void {
  const current = cache.refCounts.get(key) ?? 0
  cache.refCounts.set(key, current + 1)
}

export function decrementRefCount(key: string): number {
  const current = cache.refCounts.get(key) ?? 0
  const next = Math.max(0, current - 1)
  if (next === 0) cache.refCounts.delete(key)
  else cache.refCounts.set(key, next)
  return next
}

export function getRefCount(key: string): number {
  return cache.refCounts.get(key) ?? 0
}

/**
 * Serialize a query key to a string for cache lookup.
 */
export function serializeQueryKey(queryKey: readonly unknown[]): string {
  return JSON.stringify(queryKey)
}

// Module-level map to track GC timeouts (survives component unmount)
const gcTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

export function deleteCacheEntry(key: string): void {
  bumpGeneration(key)
  clearRetryState(key)
  inFlight.delete(key)
  cache.fetchingKeys.delete(key)
  cache.entries.delete(key)
  cache.refCounts.delete(key)
  snapshotMemo.delete(key)
  notifyKeyListeners(key)
}

/** Clears a pending GC timer (idempotent — safe on fired timers). */
export function cancelPendingGc(key: string): void {
  const existing = gcTimeouts.get(key)
  if (existing) clearTimeout(existing)
  gcTimeouts.delete(key)
}

/** Registers the GC timer that deletes the key when it has no observers. */
export function scheduleGc(
  key: string,
  timeoutId: ReturnType<typeof setTimeout>,
): void {
  gcTimeouts.set(key, timeoutId)
}

/**
 * Invalidate a query, causing it to refetch on next access.
 */
export function invalidateActivityQuery(queryKey: readonly unknown[]): void {
  const key = serializeQueryKey(queryKey)
  const entry = getCacheEntry(key)
  if (!entry) return
  setCacheEntry(key, { ...entry, dataUpdatedAt: 0 })
}

/**
 * Remove a query from the cache entirely.
 */
export function removeActivityQuery(queryKey: readonly unknown[]): void {
  const key = serializeQueryKey(queryKey)
  cancelPendingGc(key)
  deleteCacheEntry(key)
}

/**
 * Read cached data.
 */
export function getActivityQueryData<T>(
  queryKey: readonly unknown[],
): T | undefined {
  const key = serializeQueryKey(queryKey)
  return getCacheEntry<T>(key)?.data
}

/**
 * Write cached data (optimistic updates).
 */
export function setActivityQueryData<T>(
  queryKey: readonly unknown[],
  data: T,
): void {
  const key = serializeQueryKey(queryKey)
  setCacheEntry(key, {
    data,
    dataUpdatedAt: Date.now(),
    error: null,
    errorUpdatedAt: null,
  })
}

/**
 * Reset the activity query cache (mainly for testing).
 */
export function resetActivityQueryCache(): void {
  for (const timeoutId of gcTimeouts.values()) clearTimeout(timeoutId)
  gcTimeouts.clear()

  resetRetryState()

  cache.entries.clear()
  cache.keyListeners.clear()
  cache.refCounts.clear()
  cache.fetchingKeys.clear()

  inFlight.clear()
  snapshotMemo.clear()
}

/**
 * Set an error-only cache entry (for testing).
 * This simulates what happens when a fetch fails with no prior successful data.
 */
export function setErrorOnlyCacheEntry(
  queryKey: readonly unknown[],
  error: Error,
  errorUpdatedAt?: number,
): void {
  const key = serializeQueryKey(queryKey)
  setCacheEntry(key, {
    data: undefined,
    dataUpdatedAt: 0,
    error,
    errorUpdatedAt: errorUpdatedAt ?? Date.now(),
  })
}

/**
 * Accessor for the ref-count map so test helpers can seed/verify observer
 * counts against the same state the runtime uses.
 */
export const getRefCountsMap = () => cache.refCounts

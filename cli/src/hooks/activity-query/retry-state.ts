// Per-key retry state (so unmounting one observer doesn't cancel retries for others).
// Exported so the test helpers read/write the same state the runtime uses.
export const retryCounts = new Map<string, number>()
export const retryTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

// Per-key generation to prevent "resurrecting" deleted entries from late
// in-flight responses.
const generations = new Map<string, number>()

export function bumpGeneration(key: string): void {
  generations.set(key, (generations.get(key) ?? 0) + 1)
}

export function getGeneration(key: string): number {
  return generations.get(key) ?? 0
}

export function clearRetryTimeout(key: string): void {
  const t = retryTimeouts.get(key)
  if (t) clearTimeout(t)
  retryTimeouts.delete(key)
}

export function clearRetryState(key: string): void {
  clearRetryTimeout(key)
  retryCounts.delete(key)
}

/** Clear all retry timers, counts, and generations (mainly for testing). */
export function resetRetryState(): void {
  for (const t of retryTimeouts.values()) clearTimeout(t)
  retryTimeouts.clear()
  retryCounts.clear()
  generations.clear()
}

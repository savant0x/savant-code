const listeners = new Set<() => void>()
export function onProviderSelectionChanged(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
/** Run after the synchronous settings/credential transaction has settled. */
export function notifyProviderSelectionChanged(): void {
  queueMicrotask(() => {
    for (const listener of listeners) listener()
  })
}

/**
 * Test isolation: drops every provider-selection subscriber — process-lifetime
 * state `bun test` shares across files (FID-2026-1007-002).
 */
export function resetProviderMonitoringEventsState(): void {
  listeners.clear()
}

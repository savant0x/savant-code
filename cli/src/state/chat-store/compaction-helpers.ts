import type { CompactionLifecycleEvent } from './types'
import type { CompactionStatus } from '@savant-code/common/types/session-state'

/**
 * FID-2026-0814-006: shared bounded-history helper for the compaction counter
 * + transcript events. Keeps one record per run and caps the display list.
 */
export function recordRun(
  state: {
    compactionCount: number
    compactionEvents: CompactionLifecycleEvent[]
  },
  event: Omit<CompactionLifecycleEvent, 'at'> & { at?: number },
): void {
  state.compactionCount += 1
  state.compactionEvents.push({ at: Date.now(), ...event })
  if (state.compactionEvents.length > 5) {
    state.compactionEvents = state.compactionEvents.slice(-5)
  }
}

/**
 * FID-2026-0815-008 (F-11): shallow field compare for the compaction status.
 * The runtime rebuilds a fresh object per heartbeat (not reference-stable), so
 * reference equality would never no-op; comparing the three scalar fields
 * collapses equal re-deliveries into true change-only notifications.
 */
export function sameCompactionStatus(
  a: CompactionStatus | null,
  b: CompactionStatus | null,
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.phase === b.phase &&
    a.percentUsed === b.percentUsed &&
    a.tokensSaved === b.tokensSaved
  )
}

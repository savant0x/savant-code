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
 * FID-2026-0821-003-A: display-only damping for the sidebar context readout.
 * The runtime `contextTokenCount` legitimately alternates sources (provider
 * truth vs the ×1.35 estimator vs post-prune recounts), so the raw value can
 * jump several percent between heartbeats. Damping the DISPLAYED value only
 * (the pruner still consumes the raw count) renders a source flip as a
 * bounded ramp instead of an instant jump.
 *
 * Two parameters:
 * - deadband: changes within ±5% relative are suppressed entirely (no-op),
 *   so sub-deadband estimator↔truth jitter never re-renders.
 * - maxStepRatio: a larger change moves the display by at most 12% of its
 *   current value per update, so a ~35% flip renders as a smooth 2-3
 *   heartbeat glide while real monotonic growth still tracks within the
 *   bound. Returns an integer (the readout is a whole token count).
 */
export const CONTEXT_TOKEN_DEADBAND_RATIO = 0.05
export const CONTEXT_TOKEN_MAX_STEP_RATIO = 0.12

export function dampTokenCount(current: number, incoming: number): number {
  if (current <= 0) return incoming
  const delta = incoming - current
  const rel = Math.abs(delta) / current
  if (rel <= CONTEXT_TOKEN_DEADBAND_RATIO) return current
  const maxStep = Math.max(
    Math.floor(current * CONTEXT_TOKEN_MAX_STEP_RATIO),
    1,
  )
  if (Math.abs(delta) <= maxStep) return incoming
  return delta > 0 ? current + maxStep : current - maxStep
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

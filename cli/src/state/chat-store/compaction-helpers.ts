import type { LastCompactionReport } from './chat-store-common-types'
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

/**
 * Below this count the deadband/ramp trade their jitter-suppression value for
 * a real correctness cost: with a large context window (e.g. 1M tokens) a real
 * early-session count is only a few thousand tokens, and a relative deadband
 * of ±5% plus a 12% maximum step pin the readout near zero for a long stretch
 * — the operator sees "context stuck at 0/x". Small counts are therefore
 * adopted outright (exact), so the meter tracks the truth until the count is
 * large enough that relative damping is safe.
 */
export const CONTEXT_TOKEN_SMALL_COUNT_FLOOR = 10_000

export function dampTokenCount(current: number, incoming: number): number {
  // First update: no history to damp against. Small counts: adopt exactly so
  // a large-window session can't stall near zero (FID-2026-0827-001).
  if (current <= 0 || incoming <= CONTEXT_TOKEN_SMALL_COUNT_FLOOR) {
    return incoming
  }
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
 * FID-2026-0918-004: the identity of a *terminal* compaction outcome, or `null`
 * for a live state.
 *
 * Used to decide whether an incoming status ENDS an active retirement: only a
 * genuinely new terminal outcome (`compacted` / `pruned` / `ineffective`) is a
 * real compaction worth re-displaying. `compacting` / `blocked` / `warning` /
 * `idle` are live per-step states, not outcomes — a retirement must never be
 * ended by one (see `applyCompactionStatus`).
 *
 * `percentUsed` is intentionally excluded: it drifts on every step boundary
 * (recount + window re-derivation), so including it would make the identity
 * unstable and let a re-mirror through disguised as a new compaction.
 */
export function compactionStatusEpochOf(
  status: CompactionStatus | null,
): string | null {
  if (!status) return null
  if (
    status.phase !== 'compacted' &&
    status.phase !== 'pruned' &&
    status.phase !== 'ineffective'
  ) {
    return null
  }
  return `${status.phase}:${status.tokensSaved ?? 0}`
}

/**
 * FID-2026-0915-008 (F-11): shallow field compare for the compaction status.
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

/**
 * FID-2026-0918-004: shallow field compare for the compaction report, the
 * report-half analogue of `sameCompactionStatus`. Suppression of a stale
 * re-mirror is now a value-equality test over the full domain (including the
 * live phases and the no-report case), replacing the FID-2026-0917-006 epoch
 * string whose `null` return could not distinguish "no retirement active"
 * from "retired with no stable identity".
 */
export function sameCompactionReport(
  a: LastCompactionReport | null,
  b: LastCompactionReport | null,
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.summaryExcerpt === b.summaryExcerpt &&
    a.removedMessages === b.removedMessages &&
    a.tokensSaved === b.tokensSaved &&
    a.percentUsed === b.percentUsed
  )
}

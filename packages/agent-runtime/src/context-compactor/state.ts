import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

export interface CompactorOptions {
  logger: Logger
  contextWindow?: number
  model?: string
  /**
   * FID-2026-0814-004 H-05: micro-compact on/off from `compression.microCompact`
   * in `protocol.config.yaml`. `false` skips micro-compact entirely (the
   * operator's evidence-preservation off-switch); absent → enabled (default).
   */
  microCompactEnabled?: boolean
  /**
   * FID-2026-0814-004 H-06: how many recent tool results micro-compact keeps.
   * Absent → 6 (FID default 6-8). Configurable so verification-heavy runs
   * can keep more evidence at low context pressure.
   */
  microCompactMaxKeepRecent?: number
  /**
   * FID-2026-0814-004 H-06: token floor below which micro-compact never clears
   * (the pressure gate). Absent → no floor (count-only, historical).
   */
  microCompactFloorTokens?: number
  /**
   * FID-2026-0821-001 P0-3: proactive-trigger ratio fed to the shared
   * threshold resolver. Absent → DEFAULT_AUTO_COMPACT_RATIO (0.8).
   */
  autoCompactRatio?: number
}

export interface Thresholds {
  /** Token count at which auto-compact triggers */
  autoCompact: number
  /** Token count at which reactive compact triggers (hard limit) */
  reactiveCompact: number
  /** Max messages to keep in micro-compact (FID-2026-0814-004 H-06: 6) */
  microCompactMaxKeepRecent: number
  /** FID-2026-0814-004 H-06: token floor below which micro-compact never clears
   *  (context pressure gate). Absent → no floor (count-only, historical). */
  microCompactFloorTokens?: number
}

export interface MicroCompactResult {
  messages: Message[]
  tokensSaved: number
  messagesCleared: number
}

export interface AutoCompactCheck {
  shouldCompact: boolean
  reason?: string
  percentUsed?: number
}

export interface ReactiveCompactResult {
  truncated: boolean
  messages: Message[]
  tokensSaved: number
  messagesRemoved: number
}

/**
 * FID-2026-1006-002 WP5: cumulative file-tracking carried across successive
 * compactions. Mirrors the file-op subset of the context-pruner's
 * PreservedState block (readFiles / modifiedFiles / createdFiles) so the
 * tracking ledger and the preserved-state JSON stay shape-compatible.
 */
export interface FileTracking {
  /** File paths read (read_files / read_subtree). */
  readFiles: string[]
  /** File paths modified (str_replace / propose_str_replace). */
  modifiedFiles: string[]
  /** File paths created (write_file / propose_write_file). */
  createdFiles: string[]
}

/**
 * FID-2026-1006-002 WP5: hard cap per tracked-path list. The cumulative
 * ledger must not defeat the compaction it rides in on — when the cap is
 * exceeded the OLDEST entries drop (newest-first lists keep their head).
 */
export const MAX_CUMULATIVE_TRACKED_PATHS = 200

/**
 * Circuit breaker states for compaction failures.
 */
export type CircuitState = 'healthy' | 'degraded' | 'open' | 'half-open'

export const CIRCUIT_BREAKER_MAX_FAILURES = 3
export const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes
export const AUTO_COMPACT_BUFFER = 30_000 // 30k token buffer before hard limit
export const DEFAULT_AUTO_COMPACT_RATIO = 0.8
export const MIN_TRIGGER_TOKENS = 100_000

/**
 * FID-2026-0821-001 P0-3: single threshold owner — the ONE canonical
 * auto-compact trigger computation. The serialized savant handleSteps
 * mirrors this formula inline (serialized generators cannot import runtime
 * modules); a parity unit test pins the two implementations equal.
 *
 * Formula: floor(clamp(W × ratio, MIN_TRIGGER_TOKENS, W − AUTO_COMPACT_BUFFER))
 * with min-side-wins when the clamp range inverts at small windows:
 * W=128k, ratio=0.8 → min(102400, 98000) = 98000, preserving the ordering
 * invariant reactiveCompact(W) > force(W − forceCompactOffset) > autoCompact.
 */
export function resolveTriggerThreshold(
  contextWindow: number,
  ratio: number,
): number {
  const scaled = contextWindow * ratio
  const upperBound = contextWindow - AUTO_COMPACT_BUFFER
  if (upperBound < MIN_TRIGGER_TOKENS) {
    return Math.floor(Math.min(scaled, upperBound))
  }
  return Math.floor(Math.max(MIN_TRIGGER_TOKENS, Math.min(scaled, upperBound)))
}

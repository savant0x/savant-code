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
 * Circuit breaker states for compaction failures.
 */
export type CircuitState = 'healthy' | 'degraded' | 'open' | 'half-open'

export const CIRCUIT_BREAKER_MAX_FAILURES = 3
export const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes
export const AUTO_COMPACT_BUFFER = 30_000 // 30k token buffer before hard limit

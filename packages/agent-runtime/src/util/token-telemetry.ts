/**
 * P4 — Observability (FID-2026-0806-003 Phase 4).
 *
 * Extends the EXISTING cache-debug subsystem rather than duplicating it (R2):
 * the cache-debug hooks in run-agent-step/cache-debug.ts already receive the
 * provider's real usage (`CacheDebugUsageData`) via `onCacheDebugUsageReceived`.
 * This module turns that stream into first-class telemetry:
 *
 * - P4a `recordAgentTurn` — structured TokenUsageEvent (no external OTel dep in
 *   v1; OTel export can be a later adapter).
 * - P4b `CacheHitRateMonitor` — cached-token ratio per turn with the R3
 *   fallback: when the provider reports no cached tokens (all-zero window,
 *   i.e. caching unsupported/unreported), the ratio is `unknown` — never a
 *   false 0 — and the prefix-stability signal is the systemHash/toolsHash
 *   pair the cache-debug snapshot already records. Alerts on a sharp drop or
 *   a mid-run hash-pair change (research: "sudden drop → refactor prompt").
 * - P4c `recordPostCompact` — Axon-pattern PostCompact event with ratio
 *   metrics, emitted after compaction completes. Non-blocking by construction
 *   (pure logging).
 */
import type { CacheDebugUsageData } from '@savant-code/common/types/contracts/llm'
import type { Logger } from '@savant-code/common/types/contracts/logger'

export interface TokenUsageEvent {
  agentId: string
  phase: string
  promptTokens: number
  completionTokens: number
  /** Cached input tokens, or null when the provider did not report them. */
  cachedTokens: number | null
  estimatedCostUsd: number
}

/** Rough per-1M-token pricing used only for the estimated-cost telemetry. */
const PRICE_INPUT_PER_M = 3
const PRICE_OUTPUT_PER_M = 15
const PRICE_CACHED_INPUT_PER_M = 0.3

export function estimateCostUsd(
  promptTokens: number,
  completionTokens: number,
  cachedTokens: number,
): number {
  const cached = Math.min(cachedTokens, promptTokens)
  const freshInput = Math.max(0, promptTokens - cached)
  return (
    (freshInput * PRICE_INPUT_PER_M +
      cached * PRICE_CACHED_INPUT_PER_M +
      completionTokens * PRICE_OUTPUT_PER_M) /
    1_000_000
  )
}

/**
 * R3 fallback: a usage record whose cached-token field is absent/unreliable.
 *
 * FID-2026-1007-009: when the emitter reports presence explicitly, that wins —
 * a provider-reported `0` is a known value (a real cache miss) and an omitted
 * field is unknown. Without the flag the legacy heuristic stands unchanged
 * (`> 0` means known), so records that predate the flag keep their behavior.
 */
export function isCachedTokenCountKnown(usage: CacheDebugUsageData): boolean {
  if (usage.cachedInputTokensReported !== undefined) {
    return usage.cachedInputTokensReported
  }
  return (
    typeof usage.cachedInputTokens === 'number' && usage.cachedInputTokens > 0
  )
}

/**
 * P4a — emits one structured token-usage event from the existing cache-debug
 * usage hook. Best-effort: a logging failure must never break the step.
 */
export function recordAgentTurn(event: TokenUsageEvent, logger: Logger): void {
  try {
    logger.info(
      {
        axiomEvent: 'agent_turn.token_usage',
        ...event,
      },
      `Token usage for ${event.agentId} ${event.phase}`,
    )
  } catch {
    // best-effort
  }
}

export interface CacheHitMonitorOptions {
  logger: Logger
  /** Alert when the cached-token ratio drops by more than this (0..1). */
  alertDrop?: number
  /** Rolling window size for the ratio average. */
  windowSize?: number
}

interface HashPair {
  systemHash?: string
  toolsHash?: string
}

/**
 * P4b — cache-hit-rate monitor. Consumes the same usage the cache-debug hook
 * receives and derives the cached-token ratio per turn. When the provider does
 * not report cached tokens (all-zero window), the ratio is `unknown` (null) —
 * the R3 fallback — and prefix stability is instead inferred from the
 * systemHash/toolsHash pair stability the cache-debug snapshot already
 * records. Alerts fire once per detected regression.
 */
export class CacheHitRateMonitor {
  private logger: Logger
  private alertDrop: number
  private windowSize: number
  private ratios: number[] = []
  private alertedDrop = false
  private lastHashPair: HashPair | null = null
  private hashWarned = false

  constructor(options: CacheHitMonitorOptions) {
    this.logger = options.logger
    this.alertDrop = options.alertDrop ?? 0.3
    this.windowSize = options.windowSize ?? 10
  }

  /**
   * Feeds one usage record (from onCacheDebugUsageReceived). Computes the
   * per-turn cached ratio; when the record carries no cached tokens the window
   * is not extended (ratio stays unknown) but a hash-stability check still
   * runs via onPrefixStability.
   */
  onUsage(usage: CacheDebugUsageData): void {
    if (!isCachedTokenCountKnown(usage)) return
    const ratio = Math.min(
      1,
      usage.cachedInputTokens / Math.max(1, usage.inputTokens),
    )
    this.ratios.push(ratio)
    if (this.ratios.length > this.windowSize) {
      this.ratios.shift()
    }
    this.checkDrop()
  }

  /**
   * Returns the averaged cached-token ratio, or null when no window exists
   * (provider unreported caching — never a false 0).
   */
  getCacheHitRatio(): number | null {
    if (this.ratios.length === 0) return null
    return this.ratios.reduce((a, b) => a + b, 0) / this.ratios.length
  }

  /**
   * Feeds the system/tools hashes the cache-debug snapshot records. A pair
   * that was stable for at least one prior observation and then changes
   * mid-run is the signature of a prefix-stability regression.
   */
  onPrefixStability(pair: HashPair): void {
    if (pair.systemHash === undefined && pair.toolsHash === undefined) return
    if (
      this.lastHashPair !== null &&
      !this.hashWarned &&
      this.hashesChanged(this.lastHashPair, pair)
    ) {
      this.hashWarned = true
      this.logger.warn(
        { previous: this.lastHashPair, current: pair },
        'Cache-hit monitor: system/tools hash pair changed mid-run — prefix-stability regression suspected, inspect prompt assembly order',
      )
    }
    if (this.lastHashPair === null) {
      this.lastHashPair = { ...pair }
    }
  }

  /** True when the ratio is available and has dropped below the alert band. */
  private checkDrop(): void {
    if (this.alertedDrop || this.ratios.length < 2) return
    const latest = this.ratios[this.ratios.length - 1]
    const prior =
      this.ratios.slice(0, -1).reduce((a, b) => a + b, 0) /
      this.ratios.slice(0, -1).length
    if (prior - latest > this.alertDrop) {
      this.alertedDrop = true
      this.logger.warn(
        {
          priorRatio: prior,
          latestRatio: latest,
          drop: prior - latest,
        },
        `Cache-hit monitor: cached-token ratio dropped ${(prior - latest).toFixed(2)} points — inspect prompt prefix stability`,
      )
    }
  }

  private hashesChanged(a: HashPair, b: HashPair): boolean {
    if (a.systemHash !== undefined && b.systemHash !== undefined) {
      if (a.systemHash !== b.systemHash) return true
    }
    if (a.toolsHash !== undefined && b.toolsHash !== undefined) {
      if (a.toolsHash !== b.toolsHash) return true
    }
    return false
  }
}

export interface PostCompactEvent {
  originalTokens: number
  compressedTokens: number
  compressionRatio: number
  summaryPreview: string
  sessionId: string
}

/**
 * P4c — Axon-pattern PostCompact event. Emitted after a compaction completes;
 * feeds analytics + the CLI status surface. Non-blocking (pure logging) with
 * a preview capped so the event stays small.
 */
export function recordPostCompact(
  event: PostCompactEvent,
  logger: Logger,
): void {
  try {
    logger.info(
      {
        axiomEvent: 'context_compaction.post_compact',
        original_tokens: event.originalTokens,
        compressed_tokens: event.compressedTokens,
        compression_ratio: event.compressionRatio,
        summary_preview: event.summaryPreview.slice(0, 200),
        session_id: event.sessionId,
      },
      'PostCompact: context compaction completed',
    )
  } catch {
    // best-effort
  }
}

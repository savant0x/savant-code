/**
 * FID-2026-1007-009 — session cache-hit telemetry accumulator.
 *
 * The `CacheHitRateMonitor` (token-telemetry.ts) is a debug-time diagnostic:
 * it is fed only when a cache-debug correlation exists, it keeps a rolling
 * window of per-turn ratios, and it never leaves the runtime. The sidebar needs
 * the opposite: one always-on, weighted, serializable summary of the cache
 * tokens the providers actually reported for the active route and model.
 *
 * Three truthfulness rules drive this module, and all three exist because the
 * naive version is a lie about data the provider never sent:
 *
 * 1. **Unreported is not zero.** A record whose cache field was absent is
 *    counted as `unreportedTurns` and contributes to no ratio. A provider that
 *    does not report caching must render as unavailable, never as a 0% miss.
 * 2. **A reported zero is a real sample.** It counts toward the weighted
 *    denominator, so a genuine cache miss shows as a known `0%`.
 * 3. **Invalid is not success.** Negative counts, and cached counts above the
 *    input they cannot exceed, are counted as `invalidTurns` and excluded from
 *    the ratio rather than being clamped into a plausible-looking number.
 *
 * The aggregate is input-token weighted — `sum(cached) / sum(eligible input)` —
 * because a plain mean of per-turn percentages would let a 12-token turn weigh
 * as much as a 200,000-token one.
 *
 * State is passed in and returned as a plain object so it can live on
 * `agentState` and survive the SDK JSON snapshot boundary. There is no module
 * scope here by design: no preload wiring, and nothing for one chat to leak
 * into another.
 */
import type { CacheUsageSummary } from '@savant-code/common/types/session-state-cache-usage'

/** One completed provider usage observation, from the always-on usage hook. */
export interface CacheUsageRecord {
  /** Provider route id; `'unknown'` when the route is not resolvable. */
  provider: string
  /** Model id the request was actually sent to. */
  model: string
  /** Provider-reported input tokens for this observation. */
  inputTokens: number
  /** Cached input tokens, or null when the provider did not report them. */
  cachedInputTokens: number | null
  /**
   * Identity of the turn that produced this usage. A repeat of the value the
   * previous observation carried is treated as a re-finalization of the same
   * response (retry replay, stream re-finalization, session restore) and is
   * ignored rather than counted twice.
   */
  observationKey?: string
}

function bucketOf(record: CacheUsageRecord): {
  provider: string
  model: string
} {
  return {
    provider: record.provider.length > 0 ? record.provider : 'unknown',
    model: record.model.length > 0 ? record.model : 'unknown',
  }
}

function emptyBucket(provider: string, model: string): CacheUsageSummary {
  return {
    provider,
    model,
    eligibleInputTokens: 0,
    cachedInputTokens: 0,
    reportedTurns: 0,
    unreportedTurns: 0,
    invalidTurns: 0,
    cacheHitRatio: null,
  }
}

function isValidCount(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

/**
 * Folds one observation into the active bucket and returns the new summary.
 *
 * A route or model change starts a fresh bucket rather than blending unlike
 * traffic, so switching models can never improve or damage the other model's
 * number.
 */
export function accumulateCacheUsage(
  current: CacheUsageSummary | undefined,
  record: CacheUsageRecord,
): CacheUsageSummary {
  const { provider, model } = bucketOf(record)
  const switched =
    current === undefined ||
    current.provider !== provider ||
    current.model !== model
  const base = switched ? emptyBucket(provider, model) : current

  if (
    record.observationKey !== undefined &&
    record.observationKey === base.lastObservationKey
  ) {
    return base
  }
  const withKey: CacheUsageSummary =
    record.observationKey === undefined
      ? base
      : { ...base, lastObservationKey: record.observationKey }

  const cached = record.cachedInputTokens
  const invalid =
    !isValidCount(record.inputTokens) ||
    (cached !== null && (!isValidCount(cached) || cached > record.inputTokens))
  if (invalid) {
    return { ...withKey, invalidTurns: withKey.invalidTurns + 1 }
  }
  if (cached === null) {
    return { ...withKey, unreportedTurns: withKey.unreportedTurns + 1 }
  }

  const eligibleInputTokens = withKey.eligibleInputTokens + record.inputTokens
  const cachedInputTokens = withKey.cachedInputTokens + cached
  return {
    ...withKey,
    eligibleInputTokens,
    cachedInputTokens,
    reportedTurns: withKey.reportedTurns + 1,
    cacheHitRatio:
      eligibleInputTokens > 0 ? cachedInputTokens / eligibleInputTokens : null,
  }
}

// FID-2026-1007-009 — the reported provider cache-usage summary for a session.
//
// Extracted from `session-state-agent-state.ts` rather than inlined there: that
// module sits at the 300-line absolute ceiling the quality gate enforces, and a
// new field must not be paid for by deleting existing documentation.
//
// This is a *reported* usage summary, not a billing claim. `cacheHitRatio`
// divides by the input tokens the provider actually reported for records that
// carried a cache field, and is null when none did. It describes cache reuse on
// the named route only; it is not a guaranteed discount, and the runtime never
// derives a price from it.
export interface CacheUsageSummary {
  /** Provider route id the samples came from. */
  provider: string
  /** Model id the samples were sent to. */
  model: string
  /** Input tokens of the records that reported a cache field (the denominator). */
  eligibleInputTokens: number
  /** Cached input tokens those records reported (the numerator). */
  cachedInputTokens: number
  /** Observations that reported a cache count, including a reported zero. */
  reportedTurns: number
  /** Observations whose provider did not report a cache count at all. */
  unreportedTurns: number
  /** Observations rejected as impossible or malformed, excluded from the ratio. */
  invalidTurns: number
  /** `cached / eligible`, or null when nothing eligible was reported yet. */
  cacheHitRatio: number | null
  /**
   * Dedupe guard, not a display value: the observation key of the last counted
   * record, so a re-finalized response of the same turn is not counted twice.
   */
  lastObservationKey?: string
}

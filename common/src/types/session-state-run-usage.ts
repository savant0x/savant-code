// FID-2026-1007-013 — the cumulative provider-usage total for one run.
//
// Extracted from `session-state-agent-state.ts` rather than inlined there: that
// module sits near the 300-line absolute ceiling the quality gate enforces
// (same split discipline as `session-state-cache-usage.ts`).
//
// This is a *measured* total, not a billing claim: the sum of what providers
// reported on the `onUsage` channel (FID-2026-0821-001's always-on hook) for
// every LLM call of the run, main agent and subagents alike. `cachedInputTokens`
// sums the reported values; a provider that reports no cache field contributes
// its coerced 0 — the presence distinction lives on the per-observation record
// (`CacheDebugUsageData.cachedInputTokensReported`), not on the sum.
export interface RunUsageSample {
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  totalTokens: number
}

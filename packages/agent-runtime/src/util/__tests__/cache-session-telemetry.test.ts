// FID-2026-1007-009 — the always-on session cache-hit accumulator.
//
// The pins here are the truthfulness rules, not the arithmetic: an unreported
// cache field must never be counted as a miss, a reported zero must survive as
// a known value, an impossible count must be rejected rather than clamped, and
// a re-finalized response must not be counted twice.
import { describe, expect, test } from 'bun:test'

import {
  accumulateCacheUsage,
  type CacheUsageRecord,
} from '../cache-session-telemetry'

const record = (
  overrides: Partial<CacheUsageRecord> = {},
): CacheUsageRecord => ({
  provider: 'openrouter',
  model: 'openai/gpt-5',
  inputTokens: 1_000,
  cachedInputTokens: 500,
  ...overrides,
})

describe('session cache-hit accumulator (FID-2026-1007-009)', () => {
  test('the ratio is input-token weighted, not a mean of turn percentages', () => {
    // A 100-token turn that reused half its input, then a 900-token turn that
    // reused none. Weighted: 50/1000 = 5%. A mean of per-turn ratios would say
    // 25% — which would let a tiny call speak for a huge one.
    let summary = accumulateCacheUsage(
      undefined,
      record({ inputTokens: 100, cachedInputTokens: 50 }),
    )
    summary = accumulateCacheUsage(
      summary,
      record({ inputTokens: 900, cachedInputTokens: 0 }),
    )
    expect(summary.cacheHitRatio).toBeCloseTo(0.05, 10)
    expect(summary.eligibleInputTokens).toBe(1_000)
    expect(summary.cachedInputTokens).toBe(50)
    expect(summary.reportedTurns).toBe(2)
  })

  test('a reported zero is a known zero, not an absence', () => {
    const summary = accumulateCacheUsage(
      undefined,
      record({ cachedInputTokens: 0 }),
    )
    expect(summary.cacheHitRatio).toBe(0)
    expect(summary.reportedTurns).toBe(1)
    expect(summary.unreportedTurns).toBe(0)
  })

  test('an unreported cache field contributes no ratio', () => {
    const summary = accumulateCacheUsage(
      undefined,
      record({ cachedInputTokens: null }),
    )
    expect(summary.cacheHitRatio).toBeNull()
    expect(summary.eligibleInputTokens).toBe(0)
    expect(summary.unreportedTurns).toBe(1)
    expect(summary.reportedTurns).toBe(0)
  })

  test('unreported records do not dilute a real ratio', () => {
    let summary = accumulateCacheUsage(
      undefined,
      record({ inputTokens: 1_000, cachedInputTokens: 800 }),
    )
    summary = accumulateCacheUsage(
      summary,
      record({ inputTokens: 1_000, cachedInputTokens: null }),
    )
    expect(summary.cacheHitRatio).toBeCloseTo(0.8, 10)
    expect(summary.unreportedTurns).toBe(1)
  })

  test('an impossible count is rejected, not clamped into success', () => {
    let summary = accumulateCacheUsage(
      undefined,
      record({ inputTokens: 100, cachedInputTokens: 250 }),
    )
    expect(summary.invalidTurns).toBe(1)
    expect(summary.cacheHitRatio).toBeNull()
    expect(summary.eligibleInputTokens).toBe(0)

    summary = accumulateCacheUsage(
      summary,
      record({ inputTokens: 100, cachedInputTokens: -1 }),
    )
    summary = accumulateCacheUsage(
      summary,
      record({ inputTokens: Number.NaN, cachedInputTokens: 1 }),
    )
    expect(summary.invalidTurns).toBe(3)
  })

  test('a route or model change starts a fresh bucket', () => {
    const first = accumulateCacheUsage(
      undefined,
      record({ inputTokens: 1_000, cachedInputTokens: 900 }),
    )
    expect(first.cacheHitRatio).toBeCloseTo(0.9, 10)

    const switchedModel = accumulateCacheUsage(
      first,
      record({
        model: 'anthropic/claude-4',
        inputTokens: 100,
        cachedInputTokens: 0,
      }),
    )
    expect(switchedModel.model).toBe('anthropic/claude-4')
    expect(switchedModel.eligibleInputTokens).toBe(100)
    expect(switchedModel.cacheHitRatio).toBe(0)

    const switchedProvider = accumulateCacheUsage(
      switchedModel,
      record({
        provider: 'chatanywhere',
        inputTokens: 10,
        cachedInputTokens: 5,
      }),
    )
    expect(switchedProvider.provider).toBe('chatanywhere')
    expect(switchedProvider.eligibleInputTokens).toBe(10)
  })

  test('a re-finalized response of the same turn is counted once', () => {
    const keyed = record({ observationKey: 'run-1:step-1:3' })
    const first = accumulateCacheUsage(undefined, keyed)
    const replay = accumulateCacheUsage(first, keyed)
    expect(replay).toBe(first)
    expect(replay.reportedTurns).toBe(1)

    // A different turn is still counted.
    const next = accumulateCacheUsage(
      replay,
      record({ observationKey: 'run-1:step-2:4' }),
    )
    expect(next.reportedTurns).toBe(2)
  })

  test('an empty provider or model id degrades to a named bucket', () => {
    const summary = accumulateCacheUsage(
      undefined,
      record({ provider: '', model: '' }),
    )
    expect(summary.provider).toBe('unknown')
    expect(summary.model).toBe('unknown')
  })
})

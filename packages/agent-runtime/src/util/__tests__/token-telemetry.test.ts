/**
 * FID-2026-0806-003 Phase 4 (P4a/P4b/P4c) — observability tests.
 *
 * P4a: TokenUsageEvent emission (structured log, no OTel dep).
 * P4b: CacheHitRateMonitor — cached-token ratio with the R3 fallback (a
 *      provider that reports no cached tokens yields `unknown`, never a
 *      false 0) and hash-pair-change alerting.
 * P4c: PostCompact event with ratio metrics.
 */
import { describe, expect, test } from 'bun:test'

import {
  CacheHitRateMonitor,
  estimateCostUsd,
  isCachedTokenCountKnown,
  recordAgentTurn,
  recordPostCompact,
} from '../token-telemetry'

import type { CacheDebugUsageData } from '@savant-code/common/types/contracts/llm'
import type { Logger } from '@savant-code/common/types/contracts/logger'

function makeLogger(): Logger & { warns: unknown[]; infos: unknown[] } {
  const logger = {
    debug: () => {},
    info: (data?: unknown) => {
      logger.infos.push(data)
    },
    warn: (data?: unknown) => {
      logger.warns.push(data)
    },
    error: () => {},
    warns: [] as unknown[],
    infos: [] as unknown[],
  }
  return logger as unknown as Logger & { warns: unknown[]; infos: unknown[] }
}

function usage(partial: Partial<CacheDebugUsageData>): CacheDebugUsageData {
  return {
    inputTokens: 1000,
    outputTokens: 100,
    cachedInputTokens: 0,
    totalTokens: 1100,
    ...partial,
  }
}

describe('P4a recordAgentTurn', () => {
  test('emits a structured token-usage event', () => {
    const logger = makeLogger()
    recordAgentTurn(
      {
        agentId: 'detective',
        phase: 'agent_step',
        promptTokens: 1000,
        completionTokens: 100,
        cachedTokens: 400,
        estimatedCostUsd: 0.005,
      },
      logger,
    )
    expect(logger.infos.length).toBe(1)
    const event = logger.infos[0] as Record<string, unknown>
    expect(event.axiomEvent).toBe('agent_turn.token_usage')
    expect(event.agentId).toBe('detective')
    expect(event.cachedTokens).toBe(400)
  })
})

describe('P4b CacheHitRateMonitor', () => {
  test('reports unknown ratio when provider reports no cached tokens (R3 fallback)', () => {
    const logger = makeLogger()
    const monitor = new CacheHitRateMonitor({ logger })
    expect(monitor.getCacheHitRatio()).toBeNull()

    monitor.onUsage(usage({ cachedInputTokens: 0, inputTokens: 5000 }))
    monitor.onUsage(usage({ cachedInputTokens: 0, inputTokens: 5000 }))
    // All-zero window -> still unknown, never a false 0.
    expect(monitor.getCacheHitRatio()).toBeNull()
    expect(logger.warns.length).toBe(0)
  })

  test('computes the averaged cached-token ratio when reported', () => {
    const logger = makeLogger()
    const monitor = new CacheHitRateMonitor({ logger })
    monitor.onUsage(usage({ inputTokens: 10_000, cachedInputTokens: 5_000 }))
    monitor.onUsage(usage({ inputTokens: 10_000, cachedInputTokens: 7_500 }))
    const ratio = monitor.getCacheHitRatio()
    expect(ratio).not.toBeNull()
    expect(ratio!).toBeCloseTo(0.625, 2)
  })

  test('alerts when the ratio drops sharply (prefix-stability regression)', () => {
    const logger = makeLogger()
    const monitor = new CacheHitRateMonitor({
      logger,
      alertDrop: 0.3,
      windowSize: 4,
    })
    monitor.onUsage(usage({ inputTokens: 10_000, cachedInputTokens: 9_000 }))
    monitor.onUsage(usage({ inputTokens: 10_000, cachedInputTokens: 9_000 }))
    monitor.onUsage(usage({ inputTokens: 10_000, cachedInputTokens: 1_000 }))
    expect(logger.warns.length).toBe(1)
    const warning = logger.warns[0] as Record<string, unknown>
    expect(String(warning).length).toBeGreaterThan(0)
  })

  test('alerts on a mid-run system/tools hash-pair change', () => {
    const logger = makeLogger()
    const monitor = new CacheHitRateMonitor({ logger })
    monitor.onPrefixStability({ systemHash: 'abc', toolsHash: 'def' })
    monitor.onPrefixStability({ systemHash: 'abc', toolsHash: 'def' })
    // Stable pair established; now it changes mid-run.
    monitor.onPrefixStability({ systemHash: 'abc', toolsHash: 'XYZ' })
    expect(logger.warns.length).toBe(1)
  })

  test('does not alert when the hash pair is stable', () => {
    const logger = makeLogger()
    const monitor = new CacheHitRateMonitor({ logger })
    monitor.onPrefixStability({ systemHash: 'abc', toolsHash: 'def' })
    monitor.onPrefixStability({ systemHash: 'abc', toolsHash: 'def' })
    monitor.onPrefixStability({ systemHash: 'abc', toolsHash: 'def' })
    expect(logger.warns.length).toBe(0)
  })
})

describe('P4c recordPostCompact', () => {
  test('emits a PostCompact event with ratio metrics', () => {
    const logger = makeLogger()
    recordPostCompact(
      {
        originalTokens: 200_000,
        compressedTokens: 20_000,
        compressionRatio: 0.9,
        summaryPreview: '<conversation_summary>…',
        sessionId: 'run-123',
      },
      logger,
    )
    expect(logger.infos.length).toBe(1)
    const event = logger.infos[0] as Record<string, unknown>
    expect(event.axiomEvent).toBe('context_compaction.post_compact')
    expect(event.compression_ratio).toBe(0.9)
    expect(event.session_id).toBe('run-123')
  })
})

describe('helpers', () => {
  test('estimateCostUsd prices cached input cheaply', () => {
    // 1M fresh input @ $3 + 1M output @ $15 = $18
    const cost = estimateCostUsd(1_000_000, 1_000_000, 0)
    expect(cost).toBeCloseTo(18, 6)
    // Cached input replaces fresh input.
    const cachedCost = estimateCostUsd(1_000_000, 0, 1_000_000)
    expect(cachedCost).toBeCloseTo(0.3, 6)
  })

  test('isCachedTokenCountKnown treats zero as unknown (R3)', () => {
    expect(isCachedTokenCountKnown(usage({ cachedInputTokens: 500 }))).toBe(
      true,
    )
    expect(isCachedTokenCountKnown(usage({ cachedInputTokens: 0 }))).toBe(false)
  })

  // FID-2026-1007-009: the R3 heuristic is right about legacy records and wrong
  // about a provider that reports presence, so presence wins when it is there.
  // A reported zero is a real cache miss; an omitted field is not.
  test('an explicit presence flag overrides the zero-means-unknown heuristic', () => {
    expect(
      isCachedTokenCountKnown(
        usage({ cachedInputTokens: 0, cachedInputTokensReported: true }),
      ),
    ).toBe(true)
    expect(
      isCachedTokenCountKnown(
        usage({ cachedInputTokens: 0, cachedInputTokensReported: false }),
      ),
    ).toBe(false)
    // A reported positive stays known either way.
    expect(
      isCachedTokenCountKnown(
        usage({ cachedInputTokens: 900, cachedInputTokensReported: true }),
      ),
    ).toBe(true)
  })
})

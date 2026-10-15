import { describe, expect, test } from 'bun:test'

import { ContextCompactor } from '../context-compactor'
import {
  AUTO_COMPACT_BUFFER,
  MIN_TRIGGER_TOKENS,
  resolveTriggerThreshold,
} from '../context-compactor/state'

import type { Logger } from '@savant-code/common/types/contracts/logger'

const stubLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

describe('resolveTriggerThreshold (FID-2026-0821-001 P0-3)', () => {
  test('standard window: ratio governs', () => {
    expect(resolveTriggerThreshold(200_000, 0.8)).toBe(160_000)
  })

  test('floors fractional results at power-of-two windows', () => {
    expect(resolveTriggerThreshold(262_144, 0.8)).toBe(209_715)
  })

  test('small-window inversion: min side wins, ordering invariant preserved', () => {
    const w = 128_000
    const trigger = resolveTriggerThreshold(w, 0.8)
    expect(trigger).toBe(98_000)
    expect(w - 15_000).toBeGreaterThan(trigger)
  })

  test('deepseek-sized window', () => {
    expect(resolveTriggerThreshold(131_072, 0.8)).toBe(101_072)
  })

  test('tiny ratio clamps up to the floor', () => {
    expect(resolveTriggerThreshold(262_144, 0.2)).toBe(MIN_TRIGGER_TOKENS)
  })

  test('oversized ratio clamps down to the buffer bound', () => {
    expect(resolveTriggerThreshold(100_000, 1.2)).toBe(70_000)
  })

  test('buffer constant matches the documented 30k', () => {
    expect(AUTO_COMPACT_BUFFER).toBe(30_000)
  })
})

describe('ContextCompactor threshold ownership + breaker observability', () => {
  test('constructor derives autoCompact from the shared resolver', () => {
    const compactor = new ContextCompactor({
      logger: stubLogger,
      contextWindow: 200_000,
      autoCompactRatio: 0.8,
    })
    expect(compactor.getThresholds().autoCompact).toBe(
      resolveTriggerThreshold(200_000, 0.8),
    )
  })

  test('describeBreaker reports blocking + reason after repeated failures', () => {
    const compactor = new ContextCompactor({
      logger: stubLogger,
      contextWindow: 200_000,
    })
    compactor.recordCompactionResult(false)
    compactor.recordCompactionResult(false)
    compactor.recordCompactionResult(false)
    const breaker = compactor.describeBreaker()
    expect(breaker.blocking).toBe(true)
    expect(breaker.reason).toContain('Circuit breaker')
    const check = compactor.shouldAutoCompact([], 190_000)
    expect(check.shouldCompact).toBe(false)
    expect(check.reason).toBeDefined()
  })

  test('describeBreaker is non-blocking when healthy', () => {
    const compactor = new ContextCompactor({
      logger: stubLogger,
      contextWindow: 200_000,
    })
    expect(compactor.describeBreaker().blocking).toBe(false)
  })
})

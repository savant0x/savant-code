import { afterEach, describe, expect, test } from 'bun:test'

import { useChatStore } from '../chat-store'
import {
  CONTEXT_TOKEN_DEADBAND_RATIO,
  CONTEXT_TOKEN_MAX_STEP_RATIO,
  dampTokenCount,
} from '../chat-store/compaction-helpers'

afterEach(() => {
  useChatStore.getState().reset()
})

describe('sidebar no-op guards (FID-2026-0815-008 F-11)', () => {
  test('updateContextTokens does not notify subscribers on an equal value', () => {
    let notifications = 0
    const unsubscribe = useChatStore.subscribe(() => {
      notifications++
    })
    try {
      useChatStore.getState().updateContextTokens(100)
      const afterFirst = notifications
      useChatStore.getState().updateContextTokens(100) // no-op
      expect(notifications).toBe(afterFirst)
      useChatStore.getState().updateContextTokens(200) // real change
      expect(notifications).toBe(afterFirst + 1)
    } finally {
      unsubscribe()
    }
  })

  test('setCompactionStatus no-ops on a shallow-equal status (fresh object)', () => {
    let notifications = 0
    const unsubscribe = useChatStore.subscribe(() => {
      notifications++
    })
    try {
      useChatStore.getState().setCompactionStatus({ phase: 'compacting' })
      const afterFirst = notifications
      // Fresh object reference, equal fields — must not notify.
      useChatStore.getState().setCompactionStatus({ phase: 'compacting' })
      expect(notifications).toBe(afterFirst)
    } finally {
      unsubscribe()
    }
  })

  test('updateSessionCost and updateContextTokensMax no-op on equal values', () => {
    let notifications = 0
    const unsubscribe = useChatStore.subscribe(() => {
      notifications++
    })
    try {
      useChatStore.getState().updateSessionCost(42)
      useChatStore.getState().updateContextTokensMax(262_144)
      const afterFirst = notifications
      useChatStore.getState().updateSessionCost(42)
      useChatStore.getState().updateContextTokensMax(262_144)
      expect(notifications).toBe(afterFirst)
    } finally {
      unsubscribe()
    }
  })
})

describe('dampTokenCount (FID-2026-0821-003-A)', () => {
  test('first value is adopted outright (no history to damp against)', () => {
    expect(dampTokenCount(0, 100_000)).toBe(100_000)
  })

  test('sub-deadband changes are suppressed entirely', () => {
    const current = 100_000
    const withinBand = Math.floor(
      current * (1 + CONTEXT_TOKEN_DEADBAND_RATIO * 0.5),
    )
    expect(dampTokenCount(current, withinBand)).toBe(current)
  })

  test('a 35% source flip renders as a bounded ramp, not a jump', () => {
    const current = 100_000
    const flipped = 135_000 // provider truth (100k) vs ×1.35 estimator
    const damped = dampTokenCount(current, flipped)
    const maxStep = Math.floor(current * CONTEXT_TOKEN_MAX_STEP_RATIO)
    expect(damped).toBe(current + maxStep)
    expect(damped).toBeLessThan(flipped)
  })

  test('a change within the max step is adopted exactly', () => {
    const current = 100_000
    const smallGrowth = current + 10_000 // 10% < 12% step
    expect(dampTokenCount(current, smallGrowth)).toBe(smallGrowth)
  })

  test('rounds to a whole token count', () => {
    expect(Number.isInteger(dampTokenCount(1, 2))).toBe(true)
  })
})

describe('updateContextTokens damping (FID-2026-0821-003-A)', () => {
  test('a sub-deadband flip does not notify subscribers', () => {
    let notifications = 0
    const unsubscribe = useChatStore.subscribe(() => {
      notifications++
    })
    try {
      useChatStore.getState().updateContextTokens(100_000)
      const afterFirst = notifications
      // A ~2% estimator↔truth jitter must not re-render.
      useChatStore.getState().updateContextTokens(102_000)
      expect(notifications).toBe(afterFirst)
    } finally {
      unsubscribe()
    }
  })

  test('a large source flip is damped to the bounded step', () => {
    useChatStore.getState().updateContextTokens(100_000)
    useChatStore.getState().updateContextTokens(135_000)
    const damped = useChatStore.getState().contextTokensUsed
    const maxStep = Math.floor(100_000 * CONTEXT_TOKEN_MAX_STEP_RATIO)
    expect(damped).toBe(100_000 + maxStep)
    // A second heartbeat converges further toward the truth.
    useChatStore.getState().updateContextTokens(135_000)
    expect(useChatStore.getState().contextTokensUsed).toBeGreaterThan(damped)
  })
})

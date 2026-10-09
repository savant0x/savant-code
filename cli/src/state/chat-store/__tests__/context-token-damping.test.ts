import { describe, expect, test } from 'bun:test'

import {
  CONTEXT_TOKEN_SMALL_COUNT_FLOOR,
  dampTokenCount,
} from '../compaction-helpers'

describe('dampTokenCount — FID-2026-1009-002 non-positive suppression', () => {
  test('a zero incoming never wipes an established count', () => {
    // The mid-session 0/1,000,000 reset: the runtime delivers 0 (the
    // run-start immediate snapshot on a fresh state, or a provider usage
    // reporting 0 input tokens) and the old small-count floor adopted it
    // exactly, zeroing the meter while the cap stayed intact.
    expect(dampTokenCount(250_000, 0)).toBe(250_000)
  })

  test('a negative incoming never wipes an established count', () => {
    expect(dampTokenCount(45_000, -1)).toBe(45_000)
  })

  test('a zero incoming on an empty meter stays zero', () => {
    expect(dampTokenCount(0, 0)).toBe(0)
  })

  test('the first positive update is adopted exactly', () => {
    expect(dampTokenCount(0, 250_000)).toBe(250_000)
  })

  test('small positive counts are still adopted exactly (FID-2026-0827-001)', () => {
    // The early-session floor: a large-window session's real count must not
    // be pinned near zero by the deadband/ramp. Only NON-POSITIVE values
    // are suppressed.
    expect(dampTokenCount(250_000, 5_000)).toBe(5_000)
    expect(dampTokenCount(250_000, CONTEXT_TOKEN_SMALL_COUNT_FLOOR)).toBe(
      CONTEXT_TOKEN_SMALL_COUNT_FLOOR,
    )
  })

  test('sub-deadband changes are still suppressed', () => {
    // 250k → 255k is +2% — inside the ±5% deadband.
    expect(dampTokenCount(250_000, 255_000)).toBe(250_000)
  })

  test('a large jump still ramps at the max step ratio', () => {
    // 100k → 400k is +300%: the display moves by at most 12% (12k).
    expect(dampTokenCount(100_000, 400_000)).toBe(112_000)
  })

  test('a large downward jump still ramps down at the max step ratio', () => {
    // 400k → 100k is -75%: the display steps down by at most 12% (48k).
    expect(dampTokenCount(400_000, 100_000)).toBe(352_000)
  })
})

import { resolveTriggerThreshold } from '@savant-code/agent-runtime/context-compactor/state'
import { describe, expect, test } from 'bun:test'

import { TRIGGER_THRESHOLD_INLINE_SOURCE } from '../savant/handle-steps-factory'

/**
 * FID-2026-0821-003-B: structural parity between the serialized savant
 * generator's inline computeTriggerThreshold and the runtime resolver.
 *
 * The factory interpolates TRIGGER_THRESHOLD_INLINE_SOURCE verbatim into the
 * generated source (serialized generators cannot import runtime modules), so
 * eval'ing that SAME string executes the exact body the factory bakes. The
 * sweep across windows × ratios proves the two implementations are equal
 * everywhere — a future drift in either side fails loudly instead of passing
 * hand-pinned values.
 */
function loadInlineComputeTriggerThreshold(): (
  windowTokens: number,
  ratio: number,
) => number {
  // The inline source is statements (consts + function declaration), so eval
  // it directly and return the declared function as the completion value.
  // Numeric literals only — the same trust domain as the factory's own eval.
  return eval(
    `${TRIGGER_THRESHOLD_INLINE_SOURCE}\ncomputeTriggerThreshold`,
  ) as (windowTokens: number, ratio: number) => number
}

describe('inline computeTriggerThreshold parity (FID-2026-0821-003-B)', () => {
  const inline = loadInlineComputeTriggerThreshold()

  // Windows: standard 200k, power-of-two 262144/131072, small-window
  // inversion 128k/100k, baked fallback 250k/400k. Ratios: default 0.8 plus
  // clamp exercises (tiny 0.2, oversized 1.2) and a mid ratio 0.5.
  const windows = [100_000, 128_000, 131_072, 200_000, 250_000, 262_144, 400_000]
  const ratios = [0.2, 0.5, 0.8, 1.0, 1.2]

  test('matches resolveTriggerThreshold across the window/ratio sweep', () => {
    for (const window of windows) {
      for (const ratio of ratios) {
        expect(inline(window, ratio)).toBe(resolveTriggerThreshold(window, ratio))
      }
    }
  })

  test('preserves the ordering invariant at the small-window inversion', () => {
    const w = 128_000
    const trigger = inline(w, 0.8)
    expect(trigger).toBe(98_000)
    expect(w - 15_000).toBeGreaterThan(trigger)
  })

  test('clamps up to the floor at tiny ratios and down to the buffer at oversized ratios', () => {
    expect(inline(262_144, 0.2)).toBe(100_000)
    expect(inline(100_000, 1.2)).toBe(70_000)
  })
})

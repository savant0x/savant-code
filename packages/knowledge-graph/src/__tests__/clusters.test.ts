import { describe, expect, test } from 'bun:test'

import { defaultResolution } from '../clusters'

describe('defaultResolution (FID Phase 2: inversely scaled to node count)', () => {
  test('a ~2000-node repo gets resolution 1.0 (clamped)', () => {
    expect(defaultResolution(1975)).toBe(1)
    expect(defaultResolution(2000)).toBe(1)
    expect(defaultResolution(2500)).toBeCloseTo(0.8)
  })

  test('larger repos get lower resolution (coarser, bigger communities)', () => {
    expect(defaultResolution(10_000)).toBe(0.2)
    expect(defaultResolution(20_000)).toBe(0.1) // clamped floor
  })

  test('small repos stay at resolution 1.0 (ceiling clamp)', () => {
    expect(defaultResolution(1)).toBe(1)
    expect(defaultResolution(500)).toBe(1)
  })

  test('degenerate/empty input never divides by zero', () => {
    expect(defaultResolution(0)).toBe(1)
  })
})

import { describe, expect, test } from 'bun:test'

import { exitCodeFor } from './live-008-model-picker-dwell'

import type { InteractionVerdict } from './live-008-model-picker-dwell'

/**
 * FID-2026-1023-001: the dwell probe used to exit 0 whenever the picker opened,
 * whatever its interaction claims said. Those claims are what an acceptance run
 * leans on, so the decision gets its own pin: exit 0 means the picker opened and
 * every claim held.
 */
const CLAIMS = [
  'the picker recorded its open',
  'at least one navigation key was handled',
  'a filter narrowed the matched rows',
  'the close recorded its reason',
]

function verdictsWith(passIndexes: number[]): InteractionVerdict[] {
  return CLAIMS.map((claim, index) => ({
    claim,
    pass: passIndexes.includes(index),
  }))
}

describe('live-008 dwell — verdict to exit code', () => {
  test('exits 0 only when the picker opened and every claim held', () => {
    expect(exitCodeFor(true, verdictsWith([0, 1, 2, 3]))).toBe(0)
  })

  test('exits 1 when any single claim failed', () => {
    expect(exitCodeFor(true, verdictsWith([0, 1, 3]))).toBe(1)
  })

  test('exits 1 when the picker never opened, even with passing claims', () => {
    expect(exitCodeFor(false, verdictsWith([0, 1, 2, 3]))).toBe(1)
  })

  test('exits 1 when an opened picker proved no claim at all', () => {
    expect(exitCodeFor(true, [])).toBe(1)
  })

  test('follows the all-pass rule for every combination of claims', () => {
    for (let mask = 0; mask < 1 << CLAIMS.length; mask++) {
      const passing = CLAIMS.flatMap((_, index) =>
        (mask & (1 << index)) !== 0 ? [index] : [],
      )
      const allPassed = passing.length === CLAIMS.length
      expect(exitCodeFor(true, verdictsWith(passing))).toBe(allPassed ? 0 : 1)
    }
  })
})

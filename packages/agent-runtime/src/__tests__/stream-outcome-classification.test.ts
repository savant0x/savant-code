/**
 * FID-2026-1005-007 — outcome classification over every close shape
 * (declared gate). The recoverable predicate is structural: the tests prove
 * the predicate, not the intention.
 */
import { describe, expect, test } from 'bun:test'

import {
  accumulateChunk,
  classifyStreamOutcome,
  emptyAccumulation,
} from '../stream-recovery/outcome'

import type { TurnAccumulation } from '../stream-recovery/outcome'

function turn(partial: Partial<TurnAccumulation>): TurnAccumulation {
  return { ...emptyAccumulation(), ...partial }
}

describe('stream-outcome classification (FID-2026-1005-007)', () => {
  test('normal end with an answer is normal', () => {
    expect(
      classifyStreamOutcome(turn({ reasoning: 'r', bodyChars: 10 }), {
        kind: 'done',
      }),
    ).toBe('normal')
    expect(
      classifyStreamOutcome(turn({ bodyChars: 10 }), { kind: 'done' }),
    ).toBe('normal')
  })

  test('tool-call turns are never recovered', () => {
    expect(
      classifyStreamOutcome(turn({ reasoning: 'r', toolCallCount: 1 }), {
        kind: 'done',
      }),
    ).toBe('normal')
    expect(
      classifyStreamOutcome(turn({ reasoning: 'r', toolCallCount: 1 }), {
        kind: 'thrown',
      }),
    ).toBe('upstream-error')
  })

  test('empty stop (done, reasoning-only) is the measured trigger', () => {
    expect(
      classifyStreamOutcome(turn({ reasoning: 'long thought' }), {
        kind: 'done',
      }),
    ).toBe('reasoning-only-truncation')
  })

  test('bare EOF mid-reasoning (thrown cut, reasoning-only) is the trigger', () => {
    expect(
      classifyStreamOutcome(turn({ reasoning: 'long thought' }), {
        kind: 'thrown',
      }),
    ).toBe('reasoning-only-truncation')
  })

  test('explicit upstream error frame is not a trigger', () => {
    expect(
      classifyStreamOutcome(turn({ reasoning: 'r' }), {
        kind: 'thrown',
        sawErrorFrame: true,
      }),
    ).toBe('upstream-error')
    expect(
      classifyStreamOutcome(turn({ reasoning: 'r' }), {
        kind: 'done',
        sawErrorFrame: true,
      }),
    ).toBe('upstream-error')
  })

  test('user cancel and output-cap are never recovered', () => {
    expect(
      classifyStreamOutcome(turn({ reasoning: 'r' }), { kind: 'cancel' }),
    ).toBe('user-cancel')
    expect(
      classifyStreamOutcome(turn({ reasoning: 'r' }), { kind: 'cap' }),
    ).toBe('output-cap')
  })

  test("nothing-happened closes are not this FID's shape", () => {
    expect(classifyStreamOutcome(turn({}), { kind: 'done' })).toBe('normal')
    expect(classifyStreamOutcome(turn({}), { kind: 'thrown' })).toBe(
      'upstream-error',
    )
  })

  test('accumulateChunk observes StreamChunk shapes structurally', () => {
    const acc = emptyAccumulation()
    accumulateChunk(acc, { type: 'reasoning', text: 'abc' })
    accumulateChunk(acc, { type: 'text', text: 'de' })
    accumulateChunk(acc, { type: 'tool-call', toolCallId: 't1' })
    accumulateChunk(acc, { type: 'tool-call', toolCallId: 't2' })
    expect(acc).toEqual({ reasoning: 'abc', bodyChars: 2, toolCallCount: 2 })
    // Unknown shapes accumulate nothing (conservative).
    accumulateChunk(acc, { type: 'mystery' })
    expect(acc.reasoning).toBe('abc')
    expect(acc.bodyChars).toBe(2)
  })
})

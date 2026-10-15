import { describe, expect, test } from 'bun:test'

import {
  POST_TERMINAL_CONTINUATION_LIMIT,
  TURN_END_ENFORCEMENT_SURRENDER_LIMIT,
  isAutonomousContinuation,
  updatePostTerminalCounter,
  updateTurnEndBlockCounter,
} from '../run-agent-step/post-terminal-breaker'

describe('FID-2026-0822-003 post-terminal breaker', () => {
  const step = (
    prev: number,
    sawTerminalVerdict: boolean,
    shouldEndTurn = false,
    genuineUserInput = false,
  ) =>
    updatePostTerminalCounter(prev, {
      sawTerminalVerdict,
      shouldEndTurn,
      genuineUserInput,
    })

  test('consecutive overridden terminals accumulate and trip exactly at the limit', () => {
    let verdict = step(0, true)
    expect(verdict.count).toBe(1)
    expect(verdict.trip).toBe(false)
    for (let i = 1; i < POST_TERMINAL_CONTINUATION_LIMIT; i += 1) {
      verdict = step(verdict.count, true)
    }
    expect(verdict.count).toBe(POST_TERMINAL_CONTINUATION_LIMIT)
    expect(verdict.trip).toBe(true)
  })

  test('a clean terminal resets the counter', () => {
    expect(step(1, false, true).count).toBe(0)
  })

  test('an ordinary working step resets the counter', () => {
    expect(step(1, false, false).count).toBe(0)
  })

  test('genuine operator input resets the counter even after overrides', () => {
    expect(step(1, true, false, true).count).toBe(0)
  })

  test('counter persists across non-consecutive overrides only while uninterrupted', () => {
    const a = step(0, true)
    const b = step(a.count, false)
    const c = step(b.count, true)
    expect(c.count).toBe(1)
    expect(c.trip).toBe(false)
  })
})

describe('FID-2026-0822-003 enforcement surrender', () => {
  test('consecutive blocks accumulate and surrender exactly at the limit', () => {
    let v = updateTurnEndBlockCounter(0, { blocked: true })
    expect(v.surrender).toBe(false)
    v = updateTurnEndBlockCounter(v.count, { blocked: true })
    expect(v.surrender).toBe(false)
    v = updateTurnEndBlockCounter(v.count, { blocked: true })
    expect(v.count).toBe(TURN_END_ENFORCEMENT_SURRENDER_LIMIT)
    expect(v.surrender).toBe(true)
  })

  test('an unblocked verdict resets the block counter', () => {
    expect(updateTurnEndBlockCounter(2, { blocked: false }).count).toBe(0)
  })
})

describe('FID-2026-0822-003 autonomy carve-out', () => {
  test('driving/paused/blocked drive records are autonomous', () => {
    expect(isAutonomousContinuation({ drive: { status: 'active' } })).toBe(true)
    expect(isAutonomousContinuation({ drive: { status: 'paused' } })).toBe(true)
    expect(isAutonomousContinuation({ drive: { status: 'blocked' } })).toBe(
      true,
    )
  })

  test('planning/awaiting_confirmation drives are still interactive', () => {
    expect(isAutonomousContinuation({ drive: { status: 'planning' } })).toBe(
      false,
    )
    expect(
      isAutonomousContinuation({
        drive: { status: 'awaiting_confirmation' },
      }),
    ).toBe(false)
  })

  test('no drive record is not autonomous', () => {
    expect(isAutonomousContinuation({})).toBe(false)
  })

  test('an active goal is autonomous; other goal states are not', () => {
    expect(isAutonomousContinuation({ goal: { status: 'active' } })).toBe(true)
    expect(isAutonomousContinuation({ goal: { status: 'paused' } })).toBe(false)
  })
})

import { describe, expect, test } from 'bun:test'

import {
  formatSavantFreeSessionCountdown,
  formatSavantFreeSessionRemaining,
} from '../savant-free-session-display'

describe('savant-free session display formatting', () => {
  test('formats urgent countdowns', () => {
    expect(formatSavantFreeSessionCountdown(61_000)).toBe('1:01')
    expect(formatSavantFreeSessionRemaining(61_000)).toBe('1:01 left')
  })

  test('formats minute and hour remaining labels', () => {
    expect(formatSavantFreeSessionRemaining(5 * 60_000)).toBe('5m left')
    expect(formatSavantFreeSessionRemaining(60 * 60_000)).toBe('1h left')
    expect(formatSavantFreeSessionRemaining(90 * 60_000)).toBe('1h 30m left')
  })

  test('formats expired sessions as expiring', () => {
    expect(formatSavantFreeSessionRemaining(0)).toBe('expiring…')
  })
})

import { describe, test, expect } from 'bun:test'

import {
  getSavantFreeStreakBonusNote,
  getSavantFreeStreakLine,
} from '../savant-free-streak-line'

describe('getSavantFreeStreakLine', () => {
  test('hides the row for new / lapsed users (streak <= 0)', () => {
    expect(getSavantFreeStreakLine(0)).toBeNull()
    expect(getSavantFreeStreakLine(-1)).toBeNull()
  })

  test('labels and fills dots for an active streak', () => {
    expect(getSavantFreeStreakLine(2)).toEqual({
      label: '2 day streak',
      dots: '●●○○○○○',
    })
  })

  test('"day" stays singular as a compound modifier', () => {
    expect(getSavantFreeStreakLine(1)?.label).toBe('1 day streak')
    expect(getSavantFreeStreakLine(5)?.label).toBe('5 day streak')
  })

  test('fills the whole week on a 7-day milestone', () => {
    expect(getSavantFreeStreakLine(7)).toEqual({
      label: '7 day streak',
      dots: '●●●●●●●',
    })
  })

  test('stays full and gains a "+" once the streak passes the week', () => {
    expect(getSavantFreeStreakLine(9)).toEqual({
      label: '9 day streak',
      dots: '●●●●●●●+',
    })
    expect(getSavantFreeStreakLine(19)).toEqual({
      label: '19 day streak',
      dots: '●●●●●●●+',
    })
  })
})

describe('getSavantFreeStreakBonusNote', () => {
  test('hidden below the 7-day milestone', () => {
    expect(getSavantFreeStreakBonusNote({ streak: 0, accessTier: 'full' })).toBeNull()
    expect(getSavantFreeStreakBonusNote({ streak: 6, accessTier: 'full' })).toBeNull()
    expect(
      getSavantFreeStreakBonusNote({ streak: 6, accessTier: 'limited' }),
    ).toBeNull()
  })

  test('full access advertises the daily session + weekly GLM perk at 7+', () => {
    const note = getSavantFreeStreakBonusNote({ streak: 7, accessTier: 'full' })
    expect(note).toContain('GLM 5.2')
    expect(note).toContain('bonus session')
    // Daily framing for the session bonus, weekly for GLM.
    expect(note).toContain('every day')
    expect(note).toContain('each week')
  })

  test('limited access advertises only the daily session perk', () => {
    const note = getSavantFreeStreakBonusNote({ streak: 14, accessTier: 'limited' })
    expect(note).toContain('bonus session')
    expect(note).toContain('every day')
    expect(note).not.toContain('GLM')
  })
})

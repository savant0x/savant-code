import { describe, expect, test } from 'bun:test'

import {
  getSavantFreeRetentionMilestonesToFire,
  isFirstSavantFreePrompt,
  planSavantFreeRedditConversionEvents,
} from '@savant-code/common/util/reddit-savant-free-retention'

describe('isFirstSavantFreePrompt', () => {
  test('returns true on first-ever usage day', () => {
    expect(
      isFirstSavantFreePrompt({
        previousUsageDays: [],
        newUsageDayRecorded: true,
      }),
    ).toBe(true)
  })

  test('returns false on repeat prompts same day', () => {
    expect(
      isFirstSavantFreePrompt({
        previousUsageDays: ['2026-06-30'],
        newUsageDayRecorded: false,
      }),
    ).toBe(false)
  })

  test('returns false on a later usage day', () => {
    expect(
      isFirstSavantFreePrompt({
        previousUsageDays: ['2026-06-30'],
        newUsageDayRecorded: true,
      }),
    ).toBe(false)
  })
})

describe('getSavantFreeRetentionMilestonesToFire', () => {
  test('returns nothing on first-ever usage day', () => {
    expect(
      getSavantFreeRetentionMilestonesToFire({
        previousUsageDays: [],
        todayDateKey: '2026-06-30',
        newUsageDayRecorded: true,
      }),
    ).toEqual([])
  })

  test('returns nothing when no new usage day was recorded', () => {
    expect(
      getSavantFreeRetentionMilestonesToFire({
        previousUsageDays: ['2026-06-30'],
        todayDateKey: '2026-07-01',
        newUsageDayRecorded: false,
      }),
    ).toEqual([])
  })

  test('fires 1d retention on day 1', () => {
    expect(
      getSavantFreeRetentionMilestonesToFire({
        previousUsageDays: ['2026-06-30'],
        todayDateKey: '2026-07-01',
        newUsageDayRecorded: true,
      }),
    ).toEqual([1])
  })

  test('does not repeat 1d on day 2', () => {
    expect(
      getSavantFreeRetentionMilestonesToFire({
        previousUsageDays: ['2026-06-30', '2026-07-01'],
        todayDateKey: '2026-07-02',
        newUsageDayRecorded: true,
      }),
    ).toEqual([])
  })

  test('fires 7d retention on day 7', () => {
    expect(
      getSavantFreeRetentionMilestonesToFire({
        previousUsageDays: ['2026-06-30', '2026-07-01'],
        todayDateKey: '2026-07-07',
        newUsageDayRecorded: true,
      }),
    ).toEqual([7])
  })

  test('fires 1d, 7d, and 24d when user returns after a long gap', () => {
    expect(
      getSavantFreeRetentionMilestonesToFire({
        previousUsageDays: ['2026-06-01'],
        todayDateKey: '2026-07-01',
        newUsageDayRecorded: true,
      }),
    ).toEqual([1, 7, 24])
  })
})

describe('planSavantFreeRedditConversionEvents', () => {
  test('first prompt only on day 0', () => {
    expect(
      planSavantFreeRedditConversionEvents({
        previousUsageDays: [],
        todayDateKey: '2026-06-30',
        newUsageDayRecorded: true,
      }),
    ).toEqual({ fireFirstPrompt: true, retentionMilestones: [] })
  })

  test('1d retention without first prompt on day 1', () => {
    expect(
      planSavantFreeRedditConversionEvents({
        previousUsageDays: ['2026-06-30'],
        todayDateKey: '2026-07-01',
        newUsageDayRecorded: true,
      }),
    ).toEqual({ fireFirstPrompt: false, retentionMilestones: [1] })
  })
})

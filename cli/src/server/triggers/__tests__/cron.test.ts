import { describe, expect, test } from 'bun:test'

import {
  cronMatches,
  isValidCron,
  lastOccurrence,
  nextOccurrence,
  parseCron,
} from '../cron'

/** parseCron for expressions these tests have already validated. */
function must(expression: string) {
  const parsed = parseCron(expression)
  if (!parsed) throw new Error(`test bug: invalid cron ${expression}`)
  return parsed
}

/** Local-time constructor — tests must not depend on the host TZ offset. */
function at(y: number, m1: number, d: number, h = 0, min = 0): Date {
  return new Date(y, m1 - 1, d, h, min, 0, 0)
}

describe('cron parser', () => {
  test('accepts the standard 5-field subset', () => {
    for (const expr of [
      '* * * * *',
      '*/5 * * * *',
      '0 9 * * 1-5',
      '30 14 1 * *',
      '15,45 */2 * * 1,3,5',
      '1-3,7 0 */3 2,6 0',
      '59 23 31 12 *',
    ]) {
      expect(isValidCron(expr)).toBe(true)
    }
  })

  test('rejects out-of-range values, bad steps, wrong field counts', () => {
    for (const expr of [
      '60 * * * *',
      '* 24 * * *',
      '* * 0 * *',
      '* * 32 * *',
      '* * * 13 *',
      '* * * * 8',
      '1-60 * * * *',
      '*/0 * * * *',
      'a * * * *',
      '* * * *',
      '* * * * * *',
      '',
    ]) {
      expect(isValidCron(expr)).toBe(false)
    }
  })

  test('fails closed on name forms (subset is numeric-only)', () => {
    expect(isValidCron('0 9 * * MON')).toBe(false)
    expect(isValidCron('0 9 * JAN *')).toBe(false)
  })

  test('dow 7 is normalized to sunday (0)', () => {
    const sunday = at(2026, 9, 6) // a Sunday
    expect(cronMatches(must('0 0 * * 7'), sunday)).toBe(true)
    expect(cronMatches(must('0 0 * * 0'), sunday)).toBe(true)
    expect(cronMatches(must('0 0 * * 1'), sunday)).toBe(false)
  })

  test('dom/dow OR rule: both restricted → matches if EITHER matches', () => {
    // 2026-09-07 is a Monday; 2026-09-15 is a Tuesday.
    const monday = at(2026, 9, 7)
    const the15th = at(2026, 9, 15)
    const tuesdayOther = at(2026, 9, 8)
    const expr = '0 0 15 * 1'
    expect(cronMatches(must(expr), monday)).toBe(true)
    expect(cronMatches(must(expr), the15th)).toBe(true)
    expect(cronMatches(must(expr), tuesdayOther)).toBe(false)
  })

  test('unrestricted day field matches any day', () => {
    expect(cronMatches(must('0 0 * * *'), at(2026, 9, 3))).toBe(true)
  })
})

describe('nextOccurrence', () => {
  test('every-minute: strictly after the given instant', () => {
    expect(nextOccurrence('* * * * *', at(2026, 9, 3, 10, 0))).toEqual(
      at(2026, 9, 3, 10, 1),
    )
    // Sub-minute remainder is dropped: 10:00:30 → 10:01:00.
    const withSeconds = new Date(2026, 8, 3, 10, 0, 30)
    expect(nextOccurrence('* * * * *', withSeconds)).toEqual(
      at(2026, 9, 3, 10, 1),
    )
  })

  test('weekday schedule skips the weekend', () => {
    // 2026-09-04 is a Friday → next occurrence is Monday 2026-09-07.
    expect(nextOccurrence('0 9 * * 1-5', at(2026, 9, 4, 10, 0))).toEqual(
      at(2026, 9, 7, 9, 0),
    )
  })

  test('month boundary: Jan 31 base → Feb 1', () => {
    expect(nextOccurrence('0 0 1 * *', at(2026, 1, 31, 12, 0))).toEqual(
      at(2026, 2, 1, 0, 0),
    )
  })

  test('same-day later time is found; same-minute base moves to next match', () => {
    expect(nextOccurrence('30 14 * * *', at(2026, 9, 3, 9, 0))).toEqual(
      at(2026, 9, 3, 14, 30),
    )
    expect(nextOccurrence('30 14 * * *', at(2026, 9, 3, 14, 30))).toEqual(
      at(2026, 9, 4, 14, 30),
    )
  })

  test('leap day: 2026 base → next is 2028-02-29', () => {
    expect(nextOccurrence('0 0 29 2 *', at(2026, 1, 1))).toEqual(
      at(2028, 2, 29, 0, 0),
    )
  })

  test('impossible date returns null within the scan bound', () => {
    expect(nextOccurrence('0 0 31 2 *', at(2026, 1, 1))).toBeNull()
  })
})

describe('lastOccurrence', () => {
  test('latest occurrence on or before the given instant', () => {
    expect(lastOccurrence('0 3 * * *', at(2026, 9, 3, 10, 0))).toEqual(
      at(2026, 9, 3, 3, 0),
    )
    // Exactly on an occurrence → that occurrence.
    expect(lastOccurrence('0 3 * * *', at(2026, 9, 3, 3, 0))).toEqual(
      at(2026, 9, 3, 3, 0),
    )
  })

  test('crosses month and year boundaries backward', () => {
    expect(lastOccurrence('0 0 1 * *', at(2026, 3, 15, 8, 0))).toEqual(
      at(2026, 3, 1, 0, 0),
    )
    expect(lastOccurrence('0 0 1 1 *', at(2026, 6, 1, 0, 0))).toEqual(
      at(2026, 1, 1, 0, 0),
    )
  })

  test('none within the bound → null', () => {
    expect(lastOccurrence('0 0 31 2 *', at(2026, 9, 3))).toBeNull()
  })

  test('Feb 29 reaches back to the last leap day within the bound', () => {
    // 2026-01-01 base: the latest Feb 29 on-or-before is 2024-02-29.
    expect(lastOccurrence('0 0 29 2 *', at(2026, 1, 1))).toEqual(
      at(2024, 2, 29, 0, 0),
    )
  })
})

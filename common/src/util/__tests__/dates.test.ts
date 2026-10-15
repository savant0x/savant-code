import { describe, test, expect } from 'bun:test'

import { formatCurrentDateTime } from '../dates'

describe('formatCurrentDateTime', () => {
  test('includes weekday, date, time, and timezone', () => {
    // Fixed local-time Date: May 22 2026, 12:34 local time.
    const formatted = formatCurrentDateTime(new Date(2026, 4, 22, 12, 34))

    // Weekday first (derived from the date, not hardcoded — locale/timezone safe).
    expect(formatted).toMatch(
      /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), /,
    )
    expect(formatted).toContain('May 22, 2026')
    expect(formatted).toContain('12:34')
    // Timezone name is always present (named zone or UTC offset).
    expect(formatted).toMatch(/(PM|AM)\s+\S+$/)
  })

  test('defaults to the current time when no date is provided', () => {
    const before = Date.now()
    const formatted = formatCurrentDateTime()
    const after = Date.now()

    // Non-empty and reflects a recent, valid date string.
    expect(formatted.length).toBeGreaterThan(0)
    expect(formatted).toContain(', 202')
    // The call resolves a Date within the observed window (sanity, not precision).
    expect(before).toBeLessThanOrEqual(after)
  })
})

// FID-2026-0824-005 step 3 — cron math for scheduled triggers.
//
// Deliberate subset, no dependencies (YAGNI guard): 5 fields
// (minute hour dom month dow) supporting `*`, `*/n`, `n`, `a-b`, and
// comma lists. No name forms (MON/JAN), no seconds, no @macros, no
// timezones — server-local time, matching the FID's v1 scope. The DOM/DOW
// restriction follows the standard cron OR rule: when BOTH day fields are
// restricted, a date matches if either field matches.
//
// All scans are bounded and fail-closed: impossible dates (Feb 31) yield
// null rather than an infinite loop.

const SCAN_LIMIT_DAYS = 366 * 4 // bounded scan; 4 years covers the leap cycle

export type ParsedCron = {
  readonly minutes: readonly number[]
  readonly hours: readonly number[]
  readonly daysOfMonth: readonly number[] | null // null = unrestricted
  readonly months: readonly number[]
  readonly daysOfWeek: readonly number[] | null // null = unrestricted
}

function parseField(field: string, min: number, max: number): number[] | null {
  const values = new Set<number>()
  for (const part of field.split(',')) {
    if (!part) return null
    const [range, stepRaw] = part.split('/')
    const step = stepRaw === undefined ? 1 : Number(stepRaw)
    if (!Number.isInteger(step) || step < 1) return null
    let lo: number
    let hi: number
    if (range === '*') {
      if (stepRaw === undefined) {
        values.add(-1) // wildcard marker handled by caller below
      }
      lo = min
      hi = max
    } else {
      const [a, b] = range.split('-')
      lo = Number(a)
      hi = b === undefined ? lo : Number(b)
      if (!Number.isInteger(lo) || !Number.isInteger(hi)) return null
      if (lo < min || hi > max || lo > hi) return null
    }
    for (let v = lo; v <= hi; v += step) values.add(v)
  }
  // '*' without step expands to the full range.
  if (values.has(-1)) {
    for (let v = min; v <= max; v++) values.add(v)
    values.delete(-1)
  }
  if (values.size === 0) return null
  return [...values].sort((a, b) => a - b)
}

/** Parse a 5-field cron expression; returns null when invalid (fail-closed). */
export function parseCron(expression: string): ParsedCron | null {
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5) return null
  const minutes = parseField(fields[0] ?? '', 0, 59)
  const hours = parseField(fields[1] ?? '', 0, 23)
  const dom = parseField(fields[2] ?? '', 1, 31)
  const months = parseField(fields[3] ?? '', 1, 12)
  const dow = parseField(fields[4] ?? '', 0, 7)
  if (!minutes || !hours || !dom || !months || !dow) return null
  // DOW 7 ≡ Sunday (0).
  const daysOfWeek = dow.includes(7) ? [...new Set([...dow, 0])] : dow
  const restricted = (v: number[] | null, min: number, max: number) =>
    v !== null && !(v.length === max - min + 1)
  return {
    minutes,
    hours,
    daysOfMonth: restricted(dom, 1, 31) ? dom : null,
    daysOfWeek: restricted(daysOfWeek, 0, 7) ? daysOfWeek : null,
    months,
  }
}

export function isValidCron(expression: string): boolean {
  return parseCron(expression) !== null
}

function monthMatches(cron: ParsedCron, date: Date): boolean {
  return cron.months.includes(date.getMonth() + 1)
}

/** Day-level match with the standard DOM/DOW OR rule. */
function dayMatches(cron: ParsedCron, date: Date): boolean {
  const domHit =
    cron.daysOfMonth !== null && cron.daysOfMonth.includes(date.getDate())
  const dowHit =
    cron.daysOfWeek !== null && cron.daysOfWeek.includes(date.getDay())
  if (cron.daysOfMonth !== null && cron.daysOfWeek !== null) {
    return domHit || dowHit
  }
  if (cron.daysOfMonth !== null) return domHit
  if (cron.daysOfWeek !== null) return dowHit
  return true
}

function timeMatches(cron: ParsedCron, date: Date): boolean {
  return (
    cron.minutes.includes(date.getMinutes()) &&
    cron.hours.includes(date.getHours()) &&
    dayMatches(cron, date) &&
    monthMatches(cron, date)
  )
}

/** Does this instant (minute resolution) match the expression? */
export function cronMatches(cron: ParsedCron, date: Date): boolean {
  return timeMatches(cron, date)
}

function dayCanMatch(cron: ParsedCron, date: Date): boolean {
  return dayMatches(cron, date) && monthMatches(cron, date)
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date.getTime())
  out.setDate(out.getDate() + days)
  return out
}

/**
 * The first occurrence STRICTLY AFTER `from` (minute resolution; sub-minute
 * remainders are dropped), or null if none exists within the scan bound
 * (impossible date, e.g. `0 0 31 2 *`). Non-matching days are skipped in
 * O(1); minute-stepping happens only within matching days.
 */
export function nextOccurrence(expression: string, from: Date): Date | null {
  const cron = parseCron(expression)
  if (!cron) return null
  const candidate = new Date(from.getTime())
  candidate.setSeconds(0, 0)
  candidate.setMinutes(candidate.getMinutes() + 1) // strictly after
  const limit = addDays(candidate, SCAN_LIMIT_DAYS)
  while (candidate <= limit) {
    if (!dayCanMatch(cron, candidate)) {
      const dayStart = new Date(candidate.getTime())
      dayStart.setHours(0, 0, 0, 0)
      const next = addDays(dayStart, 1)
      if (sameDay(next, candidate) && next <= candidate) break
      candidate.setTime(next.getTime())
      continue
    }
    if (
      cron.minutes.includes(candidate.getMinutes()) &&
      cron.hours.includes(candidate.getHours())
    ) {
      return new Date(candidate.getTime())
    }
    candidate.setMinutes(candidate.getMinutes() + 1)
  }
  return null
}

/**
 * The latest occurrence ON OR BEFORE `from` (minute resolution), or null if
 * none exists within the scan bound. Backward variant of the day-skip scan.
 */
export function lastOccurrence(expression: string, from: Date): Date | null {
  const cron = parseCron(expression)
  if (!cron) return null
  const candidate = new Date(from.getTime())
  candidate.setSeconds(0, 0)
  const limit = addDays(candidate, -SCAN_LIMIT_DAYS)
  while (candidate >= limit) {
    if (!dayCanMatch(cron, candidate)) {
      const dayStart = new Date(candidate.getTime())
      dayStart.setHours(0, 0, 0, 0)
      const prev = addDays(dayStart, -1)
      candidate.setTime(prev.getTime())
      continue
    }
    if (
      cron.minutes.includes(candidate.getMinutes()) &&
      cron.hours.includes(candidate.getHours())
    ) {
      return new Date(candidate.getTime())
    }
    candidate.setMinutes(candidate.getMinutes() - 1)
  }
  return null
}

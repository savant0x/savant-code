// FID-2026-1005-003 Step 1 — distinct-session recurrence semantics.
// Split from experiences-dedup.test.ts to hold the 300-line ceiling; the
// shared record fixture shape mirrors that file's helper.
import {
  computeRecurrences,
  DEFAULT_MIN_SESSIONS,
} from '../experiences-dedup'

import type { ExperienceRecord } from '@savant-code/common/types/experience'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 7, 24, 12, 0, 0) // 2026-08-24T12:00:00Z

function record(
  toolName: string,
  errorFirstLine: string,
  daysAgo: number,
  sessionId = 's1',
): ExperienceRecord {
  return {
    ts: new Date(NOW - daysAgo * MS_PER_DAY).toISOString(),
    triggerType: 'tool_failure',
    toolName,
    errorFirstLine,
    contextHash: '0'.repeat(64),
    sessionId,
  }
}

describe('distinct-session recurrence (FID-2026-1005-003 Step 1)', () => {
  test('DEFAULT_MIN_SESSIONS is 3 — the documented cross-session bar', () => {
    expect(DEFAULT_MIN_SESSIONS).toBe(3)
  })

  test('3 retries in ONE session report distinctSessions: 1 (one investigation)', () => {
    const records = [
      record('run_command', 'tsc: command not found', 1, 's1'),
      record('run_command', 'tsc: command not found', 2, 's1'),
      record('run_command', 'tsc: command not found', 3, 's1'),
    ]
    const recurrences = computeRecurrences(records, { now: NOW })
    expect(recurrences).toHaveLength(1)
    expect(recurrences[0].count).toBe(3)
    expect(recurrences[0].distinctSessions).toBe(1)
  })

  test('3 occurrences across 3 sessions report distinctSessions: 3', () => {
    const records = [
      record('run_command', 'tsc: command not found', 1, 's1'),
      record('run_command', 'tsc: command not found', 2, 's2'),
      record('run_command', 'tsc: command not found', 3, 's3'),
    ]
    const recurrences = computeRecurrences(records, { now: NOW })
    expect(recurrences).toHaveLength(1)
    expect(recurrences[0].distinctSessions).toBe(3)
  })

  test('expected failures do not widen the distinct-session count', () => {
    // Two real sessions + one expected-failure session: the filtered set
    // (which feeds distinctSessions) must exclude the 404 session.
    const records = [
      record('run_command', 'real failure', 1, 's1'),
      record('run_command', 'real failure', 2, 's2'),
      record('run_command', 'HTTP 404: no results', 3, 's3'),
      record('run_command', 'real failure', 4, 's3'),
    ]
    const recurrences = computeRecurrences(records, { now: NOW })
    expect(recurrences).toHaveLength(1)
    expect(recurrences[0].count).toBe(3)
    expect(recurrences[0].distinctSessions).toBe(3)
  })
})

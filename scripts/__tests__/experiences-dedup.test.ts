import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { experienceDedupKey } from '@savant-code/common/util/experiences'

import {
  computeRecurrences,
  groupByDedupKey,
  isExpectedFailure,
  parseExperienceLedger,
  purgeExpiredTraces,
  readExperienceLedger,
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

function fixtureRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'exp-dedup-'))
}

describe('parseExperienceLedger', () => {
  test('parses valid lines and skips malformed ones fail-open', () => {
    const content = [
      JSON.stringify(record('a', 'boom', 0)),
      'this is not json',
      JSON.stringify(record('b', 'bang', 1)),
      '',
    ].join('\n')
    const parsed = parseExperienceLedger(content)
    expect(parsed).toHaveLength(2)
    expect(parsed.map((r) => r.toolName)).toEqual(['a', 'b'])
  })
})

describe('groupByDedupKey', () => {
  test('groups identical failures across sessions into one bucket', () => {
    const records = [
      record('run_command', 'ENOENT: no such file', 1, 'session-a'),
      record('run_command', 'ENOENT: no such file', 2, 'session-b'),
      record('run_command', 'a different failure', 3, 'session-a'),
    ]
    const groups = groupByDedupKey(records)
    expect(groups.size).toBe(2)
    const same = [...groups.values()].find(
      (g) => g.errorFirstLine === 'ENOENT: no such file',
    )
    expect(same?.records).toHaveLength(2)
  })

  test('Windows and POSIX spellings of the same error land in one bucket', () => {
    const a = record('read_files', 'ENOENT C:\\a\\b.ts', 1)
    const b = record('read_files', 'ENOENT C:/a/b.ts', 2)
    const groups = groupByDedupKey([a, b])
    expect(groups.size).toBe(1)
  })
})

describe('computeRecurrences (persistent cross-session counter)', () => {
  test('promotes a pattern with ≥3 occurrences within the 14-day window', () => {
    const records = [
      record('run_command', 'tsc: command not found', 1),
      record('run_command', 'tsc: command not found', 2),
      record('run_command', 'tsc: command not found', 3),
    ]
    const recurrences = computeRecurrences(records, { now: NOW })
    expect(recurrences).toHaveLength(1)
    expect(recurrences[0].toolName).toBe('run_command')
    expect(recurrences[0].count).toBe(3)
  })

  test('a once-per-session pattern across three sessions DOES promote', () => {
    // The whole point of a cross-session window vs a per-session counter.
    const records = [
      record('web_search', 'timeout', 1, 'sess-a'),
      record('web_search', 'timeout', 2, 'sess-b'),
      record('web_search', 'timeout', 3, 'sess-c'),
    ]
    const recurrences = computeRecurrences(records, { now: NOW })
    expect(recurrences).toHaveLength(1)
    expect(recurrences[0].count).toBe(3)
  })

  test('does not promote below the threshold', () => {
    const records = [
      record('run_command', 'boom', 1),
      record('run_command', 'boom', 2),
    ]
    expect(computeRecurrences(records, { now: NOW })).toHaveLength(0)
  })

  test('out-of-window occurrences do not count', () => {
    const records = [
      record('run_command', 'boom', 1),
      record('run_command', 'boom', 2),
      record('run_command', 'boom', 20), // outside the 14-day window
    ]
    expect(computeRecurrences(records, { now: NOW })).toHaveLength(0)
  })

  test('expected failures never count toward promotion', () => {
    const records = [
      record('web_search', 'HTTP 404: no results', 1),
      record('web_search', 'HTTP 404: no results', 2),
      record('web_search', 'HTTP 404: no results', 3),
    ]
    expect(computeRecurrences(records, { now: NOW })).toHaveLength(0)
  })

  test('mixed expected + real failures count only the real ones', () => {
    const records = [
      record('run_command', 'HTTP 404: not found', 1),
      record('run_command', 'HTTP 404: not found', 2),
      record('run_command', 'real failure', 1),
      record('run_command', 'real failure', 2),
      record('run_command', 'real failure', 3),
    ]
    const recurrences = computeRecurrences(records, { now: NOW })
    expect(recurrences).toHaveLength(1)
    expect(recurrences[0].errorFirstLine).toBe('real failure')
    expect(recurrences[0].count).toBe(3)
  })
})

describe('isExpectedFailure', () => {
  test('flags 404 / empty-result classes only', () => {
    expect(isExpectedFailure('HTTP 404: no results')).toBe(true)
    expect(isExpectedFailure('no results found')).toBe(true)
    // Real, promotable failures are NOT expected noise:
    expect(isExpectedFailure('tsc: command not found')).toBe(false)
    expect(isExpectedFailure('file not found')).toBe(false)
    expect(isExpectedFailure('TypeError: x is undefined')).toBe(false)
  })
})

describe('purgeExpiredTraces', () => {
  test('keeps only records within the window', () => {
    const records = [
      record('a', 'fresh', 1),
      record('b', 'stale', 20),
      record('c', 'boundary', 14),
    ]
    const kept = purgeExpiredTraces(records, { now: NOW })
    expect(kept.map((r) => r.toolName)).toEqual(['a', 'c'])
  })
})

describe('readExperienceLedger + round trip', () => {
  test('reads the ledger written by the capture sink', () => {
    const root = fixtureRoot()
    const dir = path.join(root, 'dev', 'experiences')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'raw-traces.jsonl'),
      `${JSON.stringify(record('web_search', 'boom', 1))}\n`,
      'utf8',
    )
    const records = readExperienceLedger(root)
    expect(records).toHaveLength(1)
    expect(records[0].toolName).toBe('web_search')
  })

  test('missing ledger reads as empty', () => {
    expect(readExperienceLedger(fixtureRoot())).toEqual([])
  })

  test('dedup key is stable and 64 hex chars', () => {
    expect(experienceDedupKey('run_command', 'ENOENT: no such file')).toMatch(
      /^[0-9a-f]{64}$/,
    )
    expect(experienceDedupKey('run_command', 'ENOENT: no such file')).toBe(
      experienceDedupKey('run_command', 'ENOENT: no such file'),
    )
    expect(experienceDedupKey('run_command', 'ENOENT: no such file')).not.toBe(
      experienceDedupKey('web_search', 'ENOENT: no such file'),
    )
  })
})

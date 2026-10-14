import { describe, expect, test } from 'bun:test'

import { experienceClassIdentity } from '@savant-code/common/util/experience-classes'

import { parseRecurrenceArgs } from '../experiences-probe'
import {
  evaluateClassHorizon,
  inspectLedger,
  recurrenceReport,
} from '../experiences-recurrence'

import type { ExperienceRecord } from '@savant-code/common/types/experience'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 12)
const failure: ExperienceRecord = {
  ts: new Date(NOW - 20 * DAY).toISOString(),
  triggerType: 'tool_failure',
  toolName: 'run_terminal_command',
  errorFirstLine: 'Command timed out after 30 seconds',
  contextHash: '0'.repeat(64),
  sessionId: 'old-session',
}
const key = experienceClassIdentity(failure).key
const boundary = {
  classKey: key,
  commit: 'a'.repeat(40),
  fixedAt: new Date(NOW - 15 * DAY).toISOString(),
  captureVerified: true,
  implementationEvidence: 'dev/evidence/implementation.json',
  captureEvidence: 'dev/evidence/capture.json',
  exposure: [1, 2, 3].map((day) => ({
    sessionId: `production-${day}`,
    exercisedAt: new Date(NOW - day * DAY).toISOString(),
    evidence: `dev/evidence/session-${day}.json`,
  })),
}

describe('class horizon is evidence qualified', () => {
  test('a misspelled closure option cannot quietly become a census PASS', () => {
    expect(() =>
      parseRecurrenceArgs(['--assert-repaird=FID-2026-1012-024']),
    ).toThrow('invalid')
    expect(() => parseRecurrenceArgs(['--assert-repaired='])).toThrow('invalid')
    expect(() =>
      parseRecurrenceArgs([
        '--assert-repaired=FID-2026-1012-024',
        '--assert-repaired=FID-2026-1012-023',
      ]),
    ).toThrow('repeated')
    expect(
      parseRecurrenceArgs(['--json', '--assert-repaired=FID-2026-1012-024']),
    ).toEqual({ json: true, assertion: 'FID-2026-1012-024' })
  })
  test('age and silence alone leave an old class unresolved', () => {
    expect(evaluateClassHorizon([failure], key, undefined, NOW).state).toBe(
      'unresolved',
    )
  })
  test('a full exercised window can support a repair claim', () => {
    expect(evaluateClassHorizon([failure], key, boundary, NOW).state).toBe(
      'observed',
    )
  })
  test('a short window cannot pass', () => {
    expect(
      evaluateClassHorizon(
        [failure],
        key,
        {
          ...boundary,
          fixedAt: new Date(NOW - DAY).toISOString(),
        },
        NOW,
      ).state,
    ).toBe('incomplete-observation')
  })
  test('missing capture coverage cannot pass', () => {
    expect(
      evaluateClassHorizon(
        [failure],
        key,
        {
          ...boundary,
          captureVerified: false,
        },
        NOW,
      ).state,
    ).toBe('incomplete-observation')
  })
  test('retries in one session do not prove three exposures', () => {
    expect(
      evaluateClassHorizon(
        [failure],
        key,
        {
          ...boundary,
          exposure: boundary.exposure.map((entry) => ({
            ...entry,
            sessionId: 'one',
          })),
        },
        NOW,
      ).state,
    ).toBe('incomplete-observation')
  })
  test('a renamed timeout after the boundary refutes the repair', () => {
    const renamed = {
      ...failure,
      ts: new Date(NOW - DAY).toISOString(),
      errorFirstLine: 'Command timed out after 600 seconds',
    }
    expect(
      evaluateClassHorizon([failure, renamed], key, boundary, NOW).state,
    ).toBe('recurred')
  })
  test('future exposure cannot count', () => {
    expect(
      evaluateClassHorizon(
        [failure],
        key,
        {
          ...boundary,
          exposure: boundary.exposure.map((entry) => ({
            ...entry,
            exercisedAt: new Date(NOW + DAY).toISOString(),
          })),
        },
        NOW,
      ).state,
    ).toBe('incomplete-observation')
  })
})

describe('closure ledger inspection fails closed', () => {
  test('an empty ledger cannot establish silence', () => {
    expect(inspectLedger('', NOW).issues).toEqual([
      'ledger has no valid records',
    ])
  })
  test('reports corrupt rows rather than turning them into silence', () => {
    const result = inspectLedger(
      `${JSON.stringify(failure)}\nnot-json\n{}`,
      NOW,
    )
    expect(result.records).toHaveLength(1)
    expect(result.issues).toHaveLength(2)
  })
  test('rejects invalid and future timestamps', () => {
    const result = inspectLedger(
      [
        JSON.stringify({ ...failure, ts: 'yesterday' }),
        JSON.stringify({ ...failure, ts: new Date(NOW + DAY).toISOString() }),
      ].join('\n'),
      NOW,
    )
    expect(result.issues).toHaveLength(2)
  })
  test('detects a forged stored class identity', () => {
    expect(
      inspectLedger(JSON.stringify({ ...failure, classKey: 'v1:fake' }), NOW)
        .issues,
    ).toHaveLength(1)
  })
})

describe('ownership census', () => {
  const owners = {
    version: 1 as const,
    owners: [{ classKey: key, fid: 'FID-2026-1012-023' }],
  }
  test('a single old unknown class still requires an owner', () => {
    const result = recurrenceReport(
      [failure],
      { version: 1, owners: [] },
      { version: 1, boundaries: [] },
      NOW,
    )
    expect(result.issues).toEqual([`unowned class: ${key}`])
    expect(result.classes[0]?.state).toBe('unresolved')
  })
  test('ownership does not mark a class repaired', () => {
    const result = recurrenceReport(
      [failure],
      owners,
      { version: 1, boundaries: [] },
      NOW,
    )
    expect(result.issues).toEqual([])
    expect(result.classes[0]?.state).toBe('unresolved')
  })
  test('clustered post-fix rows still refute a repair individually', () => {
    const repeated = { ...failure, ts: new Date(NOW - DAY).toISOString() }
    const result = recurrenceReport(
      [failure, repeated, repeated],
      owners,
      { version: 1, boundaries: [boundary] },
      NOW,
    )
    expect(result.classes[0]?.count).toBe(3)
    expect(result.classes[0]?.timeClusters).toBe(2)
    expect(result.classes[0]?.largestTimeCluster).toBe(2)
    expect(result.classes[0]?.postFixFailures).toBe(2)
    expect(result.issues).toContain(`unsupported repair: ${key} (recurred)`)
  })
  test('a claimed repair with no exposure fails the assertion', () => {
    const result = recurrenceReport(
      [failure],
      owners,
      {
        version: 1,
        boundaries: [{ ...boundary, exposure: [] }],
      },
      NOW,
    )
    expect(result.issues).toContain(
      `unsupported repair: ${key} (incomplete-observation)`,
    )
  })
})

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { experienceClassIdentity } from '@savant-code/common/util/experience-classes'

import { closedOwnerIssues, parseRecurrenceArgs } from '../experiences-probe'
import {
  evaluateClassHorizon,
  inspectLedger,
  recurrenceReport,
} from '../experiences-recurrence'

import type {
  ExperienceRecord,
  ExposureByClass,
  ExposureSession,
} from '@savant-code/common/types/experience'

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
}
const exposure: ExposureSession[] = [1, 2, 3].map((day) => ({
  sessionId: `production-${day}`,
  exercisedAt: new Date(NOW - day * DAY).toISOString(),
  evidence: `dev/experiences/exposure/session-${day}.json`,
}))
const exposures = new Map([[key, exposure]])

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

/** A closure claim is checked against the ledger, not against the record alone. */
function closedOwnerRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'experience-closure-'))
  roots.push(root)
  fs.mkdirSync(path.join(root, 'dev/fids'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'dev/fids/FID-2026-1012-024-fixture.md'),
    '**Status:** closed\n',
  )
  return root
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
    expect(evaluateClassHorizon([failure], key, undefined, [], NOW).state).toBe(
      'unresolved',
    )
  })
  test('a full exercised window can support a repair claim', () => {
    expect(
      evaluateClassHorizon([failure], key, boundary, exposure, NOW).state,
    ).toBe('observed')
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
        exposure,
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
        exposure,
        NOW,
      ).state,
    ).toBe('incomplete-observation')
  })
  test('retries in one session do not prove three exposures', () => {
    expect(
      evaluateClassHorizon(
        [failure],
        key,
        boundary,
        exposure.map((entry) => ({ ...entry, sessionId: 'one' })),
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
      evaluateClassHorizon([failure, renamed], key, boundary, exposure, NOW)
        .state,
    ).toBe('recurred')
  })
  test('future exposure cannot count', () => {
    expect(
      evaluateClassHorizon(
        [failure],
        key,
        boundary,
        exposure.map((entry) => ({
          ...entry,
          exercisedAt: new Date(NOW + DAY).toISOString(),
        })),
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

type OwnerManifest = Parameters<typeof recurrenceReport>[1]
type BoundaryManifest = Parameters<typeof recurrenceReport>[2]

describe('ownership census', () => {
  const owners = {
    version: 1 as const,
    owners: [{ classKey: key, fid: 'FID-2026-1012-023' }],
  }
  const noOwners = { version: 1 as const, owners: [] }
  const noBoundaries = { version: 1 as const, boundaries: [] }
  /** The census over the fixture ledger; each case names only what it varies. */
  function census(
    records: readonly ExperienceRecord[],
    ownerManifest: OwnerManifest = noOwners,
    boundaryManifest: BoundaryManifest = noBoundaries,
    exposureByClass: ExposureByClass = new Map(),
  ) {
    return recurrenceReport(
      records,
      ownerManifest,
      boundaryManifest,
      exposureByClass,
      NOW,
    )
  }
  test('closing an owner cannot bypass missing repair boundaries', () => {
    expect(
      closedOwnerIssues(
        closedOwnerRoot(),
        ['FID-2026-1012-024'],
        [{ key, owner: 'FID-2026-1012-024', state: 'unresolved' }],
      ),
    ).toEqual([`closed owner has unproved class: ${key}`])
  })
  test('an expected outcome demands no owner and no repair claim', () => {
    const expected = { ...failure, expectedness: 'expected' as const }
    const result = census([expected])
    expect(result.issues).toEqual([])
    expect(result.classes[0]?.expectedness).toBe('expected')
    expect(result.classes[0]?.state).toBe('unresolved')
  })
  test('a single old unknown class still requires an owner', () => {
    const result = census([failure])
    expect(result.issues).toEqual([`unowned class: ${key}`])
    expect(result.classes[0]?.state).toBe('unresolved')
  })
  test('ownership does not mark a class repaired', () => {
    const result = census([failure], owners)
    expect(result.issues).toEqual([])
    expect(result.classes[0]?.state).toBe('unresolved')
  })
  test('clustered post-fix rows still refute a repair individually', () => {
    const repeated = { ...failure, ts: new Date(NOW - DAY).toISOString() }
    const result = census(
      [failure, repeated, repeated],
      owners,
      { version: 1, boundaries: [boundary] },
      exposures,
    )
    expect(result.classes[0]?.count).toBe(3)
    expect(result.classes[0]?.timeClusters).toBe(2)
    expect(result.classes[0]?.largestTimeCluster).toBe(2)
    expect(result.classes[0]?.postFixFailures).toBe(2)
    expect(result.issues).toContain(`unsupported repair: ${key} (recurred)`)
  })
  test('exposure the store holds earns an observed repair', () => {
    const result = census(
      [failure],
      owners,
      { version: 1, boundaries: [boundary] },
      exposures,
    )
    expect(result.classes[0]?.state).toBe('observed')
    expect(result.issues).toEqual([])
  })
  test('an in-window repair is reported as state, not a census failure', () => {
    const result = census([failure], owners, {
      version: 1,
      boundaries: [{ ...boundary, fixedAt: new Date(NOW - DAY).toISOString() }],
    })
    expect(result.classes[0]?.state).toBe('incomplete-observation')
    expect(result.issues).toEqual([])
  })
  test('a window that elapsed without exposure fails the census', () => {
    const result = census([failure], owners, {
      version: 1,
      boundaries: [boundary],
    })
    expect(result.issues).toContain(
      `repair window elapsed without qualified exposure: ${key}`,
    )
  })
  test('a repair declared without capture coverage fails at once', () => {
    const result = census(
      [failure],
      owners,
      { version: 1, boundaries: [{ ...boundary, captureVerified: false }] },
      exposures,
    )
    expect(result.issues).toContain(
      `repair declared without capture coverage: ${key}`,
    )
  })
})

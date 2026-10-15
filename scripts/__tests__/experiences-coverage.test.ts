import { describe, expect, it } from 'bun:test'

import { experienceClassIdentity } from '@savant-code/common/util/experience-classes'

import {
  ELIGIBILITY_DAYS,
  findUnownedEligibleClasses,
  formatClassCoverageIssue,
} from '../experiences-coverage'

import type { ExperienceRecord } from '@savant-code/common/types/experience'

const DAY = 86_400_000
const now = Date.parse('2026-10-13T12:00:00.000Z')

/**
 * FID-2026-1012-021: fixtures are built in memory. Nothing here appends a
 * fabricated failure to the production capture.
 */
function record(params: {
  sessionId: string
  daysAgo: number
  errorFirstLine?: string
  toolName?: string
  expectedness?: 'expected' | 'unexpected' | 'undetermined'
}): ExperienceRecord {
  return {
    ts: new Date(now - params.daysAgo * DAY).toISOString(),
    triggerType: 'tool_failure',
    toolName: params.toolName ?? 'read_url',
    errorFirstLine:
      params.errorFirstLine ?? 'Failed to fetch URL: 404 Not Found',
    contextHash: 'a'.repeat(64),
    sessionId: params.sessionId,
    ...(params.expectedness ? { expectedness: params.expectedness } : {}),
  }
}

const classKeyOf = (entry: ExperienceRecord) =>
  experienceClassIdentity(entry).key

describe('findUnownedEligibleClasses', () => {
  it('fails on a class above the bar with no owner, naming count and last sighting', () => {
    const records = [
      record({ sessionId: 's1', daysAgo: 1 }),
      record({ sessionId: 's2', daysAgo: 2 }),
      record({ sessionId: 's3', daysAgo: 3 }),
    ]

    const issues = findUnownedEligibleClasses({ records, owners: [], now })

    expect(issues).toHaveLength(1)
    expect(issues[0]?.classKey).toBe(classKeyOf(records[0]!))
    expect(issues[0]?.count).toBe(3)
    expect(issues[0]?.sessions).toBe(3)
    expect(issues[0]?.toolName).toBe('read_url')
    const rendered = formatClassCoverageIssue(issues[0]!)
    expect(rendered).toContain('unowned recurring class')
    expect(rendered).toContain('class-owners.json')
    expect(rendered).toContain(new Date(now - DAY).toISOString().slice(0, 10))
  })

  it('passes once the class has an owner', () => {
    const records = [
      record({ sessionId: 's1', daysAgo: 1 }),
      record({ sessionId: 's2', daysAgo: 2 }),
      record({ sessionId: 's3', daysAgo: 3 }),
    ]

    expect(
      findUnownedEligibleClasses({
        records,
        owners: [classKeyOf(records[0]!)],
        now,
      }),
    ).toEqual([])
  })

  it('ignores a class below the session bar or outside the window', () => {
    const belowBar = [
      record({ sessionId: 's1', daysAgo: 1 }),
      record({ sessionId: 's2', daysAgo: 2 }),
    ]
    const stale = [
      record({ sessionId: 's1', daysAgo: ELIGIBILITY_DAYS + 1 }),
      record({ sessionId: 's2', daysAgo: ELIGIBILITY_DAYS + 2 }),
      record({ sessionId: 's3', daysAgo: ELIGIBILITY_DAYS + 3 }),
    ]

    expect(
      findUnownedEligibleClasses({ records: belowBar, owners: [], now }),
    ).toEqual([])
    expect(
      findUnownedEligibleClasses({ records: stale, owners: [], now }),
    ).toEqual([])
  })

  it('never demands an owner for an expected outcome', () => {
    const records = [
      record({ sessionId: 's1', daysAgo: 1, expectedness: 'expected' }),
      record({ sessionId: 's2', daysAgo: 2, expectedness: 'expected' }),
      record({ sessionId: 's3', daysAgo: 3, expectedness: 'expected' }),
    ]

    expect(findUnownedEligibleClasses({ records, owners: [], now })).toEqual([])
  })

  it('groups by stable class identity, not by tool alone', () => {
    const notFound = [
      record({ sessionId: 's1', daysAgo: 1 }),
      record({ sessionId: 's2', daysAgo: 2 }),
      record({ sessionId: 's3', daysAgo: 3 }),
    ]
    const denied = [
      record({
        sessionId: 's4',
        daysAgo: 1,
        errorFirstLine: 'Failed to fetch URL: 403 Forbidden',
      }),
    ]

    const issues = findUnownedEligibleClasses({
      records: [...notFound, ...denied],
      owners: [classKeyOf(notFound[0]!)],
      now,
    })

    expect(issues).toHaveLength(0)
  })
})

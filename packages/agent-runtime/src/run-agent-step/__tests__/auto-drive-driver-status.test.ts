// FID-2026-0819-005 Loop 221: buildDriveStatusRecord suite, moved verbatim
// from auto-drive-driver.test.ts (parent over the 300-line ceiling).
// See auto-drive-driver.test.ts for the sibling suites' contract.

import { describe, expect, it } from 'bun:test'

import { buildDriveStatusRecord } from '../auto-drive-driver'

import type { DriveRecord } from '@savant-code/common/types/session-state'

describe('buildDriveStatusRecord', () => {
  function makeDrive(overrides: Partial<DriveRecord> = {}): DriveRecord {
    return {
      driveId: 'drv-1',
      goal: 'fix the flaky tests',
      acceptanceCriteria: ['pass'],
      status: 'active',
      startedAt: 1000,
      activeFid: 'FID-2',
      expectPhase: 'audit',
      initialOpenCount: 2,
      ...overrides,
    }
  }

  function fid(
    id: string,
    status: string,
  ): {
    id: string
    fileName: string
    status: string
    dependsOn: string[]
    content: string
  } {
    return { id, fileName: `${id}.md`, status, dependsOn: [], content: '' }
  }

  it('mirrors drive fields + open count + trend + run log count', () => {
    const status = buildDriveStatusRecord({
      drive: makeDrive(),
      queue: [
        fid('FID-1', 'closed'),
        fid('FID-2', 'analyzed'),
        fid('FID-3', 'created'),
      ],
      masterContent: '## Run Log\n\n- a\n- b\n- c\n',
    })
    expect(status.autoRunId).toBe('drv-1')
    expect(status.goal).toBe('fix the flaky tests')
    expect(status.activeFid).toBe('FID-2')
    expect(status.phase).toBe('audit')
    expect(status.openCount).toBe(2)
    expect(status.queueTrend).toBe(0)
    expect(status.runLogCount).toBe(3)
    expect(status.startedAt).toBe(1000)
  })

  it('computes a positive queue-growth trend', () => {
    const status = buildDriveStatusRecord({
      drive: makeDrive({ initialOpenCount: 1 }),
      queue: [
        fid('FID-1', 'analyzed'),
        fid('FID-2', 'created'),
        fid('FID-3', 'created'),
      ],
      masterContent: '',
    })
    expect(status.queueTrend).toBe(2)
    expect(status.runLogCount).toBe(0)
  })

  it('defaults the baseline to the current open count when unset', () => {
    const status = buildDriveStatusRecord({
      drive: makeDrive({ initialOpenCount: undefined }),
      queue: [fid('FID-1', 'analyzed')],
      masterContent: '',
    })
    expect(status.queueTrend).toBe(0)
  })
})

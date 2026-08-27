import { describe, expect, test } from 'bun:test'

import { autoDriveHaltLabel, summarizeAutoDrive } from '../AutoDriveDashboard'

const base = {
  projectId: 'repo-a',
}

describe('Auto Drive dashboard projection', () => {
  test('labels every halt lifecycle state explicitly', () => {
    expect(autoDriveHaltLabel('idle')).toBe('Emergency halt')
    expect(autoDriveHaltLabel('requested')).toBe('Halt requested')
    expect(autoDriveHaltLabel('confirmed')).toBe('Halt accepted')
    expect(autoDriveHaltLabel('failed')).toBe('Retry emergency halt')
  })

  test('summarizes lifecycle statuses without inventing dependency edges', () => {
    expect(
      summarizeAutoDrive([
        { ...base, fidId: 'FID-A', status: 'created' },
        { ...base, fidId: 'FID-B', status: 'fixed' },
        { ...base, fidId: 'FID-C', status: 'closed', parentId: 'FID-A' },
      ]),
    ).toEqual({
      total: 3,
      open: 2,
      byStatus: {
        created: 1,
        analyzed: 0,
        fixed: 1,
        verified: 0,
        converged: 0,
        closed: 1,
      },
      roots: ['FID-A', 'FID-B'],
      edges: [{ parentId: 'FID-A', childId: 'FID-C' }],
    })
  })

  test('empty inventory is an idle zero summary', () => {
    expect(summarizeAutoDrive([])).toEqual({
      total: 0,
      open: 0,
      byStatus: {
        created: 0,
        analyzed: 0,
        fixed: 0,
        verified: 0,
        converged: 0,
        closed: 0,
      },
      roots: [],
      edges: [],
    })
  })
})

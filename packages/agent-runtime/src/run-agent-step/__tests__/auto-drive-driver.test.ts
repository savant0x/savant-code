import { describe, expect, it } from 'bun:test'

import {
  buildPhaseDirective,
  canResumeDrive,
  countRunLogEvents,
  demoteStaleActiveDrive,
  nextPhaseAfter,
  orderFids,
  readMasterFidContent,
  selectActiveFid,
  shouldBoundaryCompact,
} from '../auto-drive-driver'
import { appendDocumentedDefault, appendRunLogEvent } from '../run-log'

import type { RunLogEvent } from '@savant-code/common/types/auto-drive'
import type { DriveRecord } from '@savant-code/common/types/session-state'

describe('buildPhaseDirective', () => {
  it('escapes FID/goal as data', () => {
    const directive = buildPhaseDirective({
      fid: 'FID-1',
      phase: 'green',
      goal: 'fix <login> & ship',
    })
    expect(directive).toContain('<untrusted_fid>FID-1</untrusted_fid>')
    expect(directive).toContain('&lt;login&gt;')
    expect(directive).not.toContain('<login>')
  })
})

describe('nextPhaseAfter', () => {
  it('stays on the phase while evidence is incomplete', () => {
    expect(nextPhaseAfter('red', false)).toBe('red')
  })

  it('advances through the full loop', () => {
    expect(nextPhaseAfter('red', true)).toBe('green')
    expect(nextPhaseAfter('green', true)).toBe('audit')
    expect(nextPhaseAfter('audit', true)).toBe('adversarial')
    expect(nextPhaseAfter('adversarial', true)).toBe('complete')
    expect(nextPhaseAfter('complete', true)).toBeNull()
  })
})

describe('orderFids', () => {
  it('orders by dependency edges', () => {
    const fids = [
      {
        id: 'FID-2',
        fileName: 'x',
        status: 'analyzed',
        dependsOn: ['FID-1'],
        content: '',
      },
      {
        id: 'FID-1',
        fileName: 'y',
        status: 'analyzed',
        dependsOn: [],
        content: '',
      },
    ]
    expect(orderFids(fids)).toEqual(['FID-1', 'FID-2'])
  })
})

describe('selectActiveFid', () => {
  it('selects the first non-closed FID in dependency order', () => {
    const fids = [
      {
        id: 'FID-2',
        fileName: 'x',
        status: 'closed',
        dependsOn: ['FID-1'],
        content: '',
      },
      {
        id: 'FID-1',
        fileName: 'y',
        status: 'analyzed',
        dependsOn: [],
        content: '',
      },
    ]
    expect(selectActiveFid(fids)?.id).toBe('FID-1')
  })

  it('returns null when every FID is closed (zero-open-FID)', () => {
    const fids = [
      {
        id: 'FID-1',
        fileName: 'y',
        status: 'closed',
        dependsOn: [],
        content: '',
      },
    ]
    expect(selectActiveFid(fids)).toBeNull()
  })
})

describe('shouldBoundaryCompact', () => {
  it('fires only when a boundary is flagged AND the context is over budget', () => {
    expect(
      shouldBoundaryCompact({
        fidBoundaryDue: true,
        contextTokenCount: 200_000,
        reactiveCompactThreshold: 200_000,
      }),
    ).toBe(true)
    expect(
      shouldBoundaryCompact({
        fidBoundaryDue: true,
        contextTokenCount: 100_000,
        reactiveCompactThreshold: 200_000,
      }),
    ).toBe(false)
    expect(
      shouldBoundaryCompact({
        fidBoundaryDue: false,
        contextTokenCount: 250_000,
        reactiveCompactThreshold: 200_000,
      }),
    ).toBe(false)
  })
})

describe('demoteStaleActiveDrive', () => {
  it('demotes an active drive to paused (crash safety)', () => {
    const drive: DriveRecord = {
      driveId: 'd',
      goal: 'g',
      acceptanceCriteria: [],
      status: 'active',
      startedAt: 0,
    }
    demoteStaleActiveDrive(drive)
    expect(drive.status).toBe('paused')
  })

  it('is a no-op for paused/blocked/absent drives', () => {
    const paused: DriveRecord = {
      driveId: 'd',
      goal: 'g',
      acceptanceCriteria: [],
      status: 'paused',
      startedAt: 0,
    }
    expect(demoteStaleActiveDrive(paused)?.status).toBe('paused')
    expect(demoteStaleActiveDrive(undefined)).toBeUndefined()
  })
})

describe('canResumeDrive', () => {
  const paused: DriveRecord = {
    driveId: 'd',
    goal: 'g',
    acceptanceCriteria: [],
    status: 'paused',
    startedAt: 0,
  }
  const active: DriveRecord = { ...paused, status: 'active' }

  it('resume is available only for an inert drive + open FIDs', () => {
    expect(canResumeDrive({ drive: paused, openFidIds: ['FID-1'] })).toBe(true)
    expect(canResumeDrive({ drive: active, openFidIds: ['FID-1'] })).toBe(false)
    expect(canResumeDrive({ drive: paused, openFidIds: [] })).toBe(false)
    expect(canResumeDrive({ drive: undefined, openFidIds: ['FID-1'] })).toBe(
      false,
    )
  })
})

describe('countRunLogEvents', () => {
  it('counts bullets under ## Run Log and stops at the next heading', () => {
    const content = [
      '## Summary',
      '',
      '## Run Log',
      '',
      '- a | rung 1 | x | retry | why',
      '- b | rung 4 | y | discovery | out of scope',
      '',
      '## Resolution',
      '',
      '- not a run log',
    ].join('\n')
    expect(countRunLogEvents(content)).toBe(2)
  })

  it('returns 0 when there is no Run Log section', () => {
    expect(countRunLogEvents('# FID\n\n## Summary\n')).toBe(0)
  })
})

describe('readMasterFidContent', () => {
  it('returns the content of the FID carrying ## Run Log', () => {
    const queue = [
      {
        id: 'FID-2',
        fileName: 'b',
        status: 'analyzed',
        dependsOn: [],
        content: '# child\n',
      },
      {
        id: 'FID-1',
        fileName: 'a',
        status: 'analyzed',
        dependsOn: [],
        content: '## Run Log\n\n- event\n',
      },
    ]
    expect(readMasterFidContent('/unused', queue)).toBe(
      '## Run Log\n\n- event\n',
    )
  })

  it('returns empty string when no FID has a Run Log', () => {
    expect(
      readMasterFidContent('/unused', [
        {
          id: 'FID-1',
          fileName: 'a',
          status: 'analyzed',
          dependsOn: [],
          content: '# plain\n',
        },
      ]),
    ).toBe('')
  })
})

describe('appendRunLogEvent', () => {
  it('creates a Run Log section when absent', () => {
    const event: RunLogEvent = {
      timestamp: 0,
      rung: 4,
      fid: 'FID-1',
      decision: 'discovery',
      rationale: 'out of scope',
      evidenceRefs: ['a.ts'],
    }
    const out = appendRunLogEvent('# FID\n\n## Resolution\n', event)
    expect(out).toContain('## Run Log')
    expect(out).toContain('rung 4')
  })

  it('appends under an existing Run Log heading', () => {
    const event: RunLogEvent = {
      timestamp: 0,
      rung: 1,
      fid: 'FID-1',
      decision: 'retry',
      rationale: 'compile',
      evidenceRefs: [],
    }
    const out = appendRunLogEvent('## Run Log\n\n- old\n', event)
    expect(out.indexOf('- old')).toBeGreaterThan(out.indexOf('## Run Log'))
    expect(out).toContain('rung 1')
  })
})

describe('appendDocumentedDefault', () => {
  it('appends a decision block to the GREEN section', () => {
    const out = appendDocumentedDefault(
      '# FID\n\n### GREEN\n\nThe fix.\n\n### AUDIT\n',
      {
        issue: 'spec gap',
        chosenDefault: 'most-robust default',
        rationale: 'operator pre-authorized',
      },
    )
    expect(out).toContain('Documented default (rung 5)')
    expect(out).toContain('**Decision:** most-robust default')
    // The decision block lands before AUDIT.
    expect(out.indexOf('Documented default')).toBeLessThan(
      out.indexOf('### AUDIT'),
    )
  })

  it('creates a GREEN section when absent', () => {
    const out = appendDocumentedDefault('# FID\n\n## Resolution\n', {
      issue: 'gap',
      chosenDefault: 'd',
      rationale: 'r',
    })
    expect(out).toContain('### GREEN')
    expect(out).toContain('Documented default (rung 5)')
  })
})

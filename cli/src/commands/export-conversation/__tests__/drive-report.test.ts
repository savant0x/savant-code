import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  extractRunLogLines,
  findMasterFidRunLog,
  renderCertificationHtml,
  renderDriveReportHtml,
} from '../drive-report'

import type { DriveCertification } from '@savant-code/common/types/auto-drive'
import type { DriveRecord } from '@savant-code/common/types/session-state'

function makeDrive(overrides: Partial<DriveRecord> = {}): DriveRecord {
  return {
    driveId: 'drv-1',
    goal: 'fix the flaky tests',
    acceptanceCriteria: ['tests pass'],
    status: 'active',
    startedAt: 1,
    activeFid: 'FID-2026-0818-999',
    expectPhase: 'audit',
    ...overrides,
  }
}

describe('extractRunLogLines', () => {
  test('extracts bullets under ## Run Log and stops at the next heading', () => {
    const content = [
      '## Summary',
      '',
      'text',
      '',
      '## Run Log',
      '',
      '- 2026-08-18T00:00:00.000Z | rung 1 | FID-1 | retry | rationale',
      '- 2026-08-18T00:00:01.000Z | rung 4 | FID-2 | discovery | more',
      '',
      '## Something Else',
      '',
      '- not a run log entry',
    ].join('\n')
    expect(extractRunLogLines(content)).toEqual([
      '- 2026-08-18T00:00:00.000Z | rung 1 | FID-1 | retry | rationale',
      '- 2026-08-18T00:00:01.000Z | rung 4 | FID-2 | discovery | more',
    ])
  })

  test('returns empty when no Run Log section exists', () => {
    expect(extractRunLogLines('# FID\n\nno section')).toEqual([])
  })

  test('skips non-bullet lines (whitespace, prose)', () => {
    const content = '## Run Log\n\nplain prose\n\n- real event\n'
    expect(extractRunLogLines(content)).toEqual(['- real event'])
  })
})

describe('findMasterFidRunLog', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-drive-report-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('finds the FID carrying a Run Log section', () => {
    const fids = path.join(tempDir, 'dev', 'fids')
    fs.mkdirSync(fids, { recursive: true })
    fs.writeFileSync(
      path.join(fids, 'FID-2026-0818-001-master.md'),
      '## Run Log\n\n- a | rung 2 | FID-x | decision | rationale\n',
    )
    fs.writeFileSync(
      path.join(fids, 'FID-2026-0818-002-child.md'),
      '# child\n\n## Summary\n\nno run log\n',
    )

    const result = findMasterFidRunLog(tempDir)
    expect(result?.fileName).toBe('FID-2026-0818-001-master.md')
    expect(result?.lines).toEqual([
      '- a | rung 2 | FID-x | decision | rationale',
    ])
  })

  test('returns null when no FID has a Run Log', () => {
    const fids = path.join(tempDir, 'dev', 'fids')
    fs.mkdirSync(fids, { recursive: true })
    fs.writeFileSync(path.join(fids, 'FID-2026-0818-001.md'), '# no log\n')
    expect(findMasterFidRunLog(tempDir)).toBeNull()
  })

  test('returns null when dev/fids is absent', () => {
    expect(findMasterFidRunLog(tempDir)).toBeNull()
  })
})

describe('renderDriveReportHtml', () => {
  test('returns empty string when there is no drive and no run log', () => {
    expect(renderDriveReportHtml({ drive: null, runLog: null })).toBe('')
  })

  test('renders drive metadata + empty certification', () => {
    const html = renderDriveReportHtml({
      drive: makeDrive(),
      runLog: null,
    })
    expect(html).toContain('Auto Drive')
    expect(html).toContain('drv-1')
    expect(html).toContain('fix the flaky tests')
    expect(html).toContain('FID-2026-0818-999')
    expect(html).toContain('Certification')
    expect(html).toContain('audit has not run')
  })

  test('renders a Run Log section with escaped bullets', () => {
    const html = renderDriveReportHtml({
      drive: null,
      runLog: {
        fileName: 'FID-master.md',
        lines: ['- <script> | rung 1 | x | retry | why'],
      },
    })
    expect(html).toContain('Run Log')
    expect(html).toContain('FID-master.md')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })

  test('escapes drive goal/active FID against HTML injection', () => {
    const html = renderDriveReportHtml({
      drive: makeDrive({ goal: '<img src=x>', activeFid: '<b>FID</b>' }),
      runLog: null,
    })
    expect(html).toContain('&lt;img src=x&gt;')
    expect(html).toContain('&lt;b&gt;FID&lt;/b&gt;')
  })
})

describe('renderCertificationHtml', () => {
  test('renders results table + gaps', () => {
    const certification: DriveCertification = {
      results: [
        {
          criterionId: 'c1',
          strategy: 'typecheck',
          status: 'pass',
          evidence: 'typecheck exit 0',
        },
        {
          criterionId: 'c2',
          strategy: 'feature-grep',
          status: 'fail',
          evidence: '0 grep matches',
        },
        {
          criterionId: 'c3',
          strategy: 'judgment',
          status: 'gap',
          evidence: 'needs Scribe cross-check',
        },
      ],
      gaps: ['gap-one', 'gap-two'],
    }
    const html = renderCertificationHtml(certification)
    expect(html).toContain('dr-pass')
    expect(html).toContain('dr-fail')
    expect(html).toContain('dr-gap')
    expect(html).toContain('PASS')
    expect(html).toContain('FAIL')
    expect(html).toContain('GAP')
    expect(html).toContain('gap-one')
    expect(html).toContain('gap-two')
    expect(html).toContain('Scribe cross-check')
  })

  test('renders no-gaps message for a clean certification', () => {
    const certification: DriveCertification = { results: [], gaps: [] }
    const html = renderCertificationHtml(certification)
    expect(html).toContain('No gaps')
  })

  test('null certification renders the not-run notice', () => {
    expect(renderCertificationHtml(null)).toContain('audit has not run')
  })
})

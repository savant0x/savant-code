/**
 * FID-2026-1019-001 — month grouping for `dev/session-summaries`.
 *
 * Pins the three properties the automatic run depends on: the bucket comes from
 * the filename (never from mtime, which a copy or export rewrites), a collision
 * is reported instead of overwritten, and a second run is a no-op. The two
 * pre-convention name shapes in the live directory are covered because they are
 * the reason the parser has a legacy branch at all.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  organizeSessionSummaries,
  planSessionSummaryOrganization,
  sessionSummaryOrganizationLine,
  sessionSummaryReference,
  summaryMonth,
} from '../session-summaries-organize'

const roots: string[] = []

function scratch(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'session-summaries-'))
  roots.push(root)
  return root
}

/** Narrow the union: tests name the bucket, not the discrimination tag. */
function monthOf(name: string): string | undefined {
  const parsed = summaryMonth(name)
  return parsed.ok ? parsed.month : undefined
}

function write(root: string, name: string, body = name): void {
  fs.writeFileSync(path.join(root, name), `${body}\n`, 'utf8')
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

describe('summaryMonth', () => {
  test('reads the canonical date-first shape', () => {
    expect(summaryMonth('2026-10-19-release-audit.md')).toEqual({
      ok: true,
      month: '2026-10',
      day: '19',
      legacy: false,
    })
  })

  test('groups non-markdown artifacts by the same date prefix', () => {
    expect(monthOf('2026-10-17-fid-worktrees-tests.log')).toBe('2026-10')
    expect(monthOf('2026-10-03-free-provider-desktop-smoke.png')).toBe(
      '2026-10',
    )
  })

  test('reads the pre-convention YYYY-MMDD shape', () => {
    expect(summaryMonth('2026-0721-1800.md')).toEqual({
      ok: true,
      month: '2026-07',
      day: '21',
      legacy: true,
    })
    expect(monthOf('2026-0823-2328-command-deck.md')).toBe('2026-08')
  })

  test('rejects impossible dates instead of inventing a month', () => {
    expect(summaryMonth('2026-13-01-nope.md').ok).toBe(false)
    expect(summaryMonth('2026-02-30-nope.md').ok).toBe(false)
    expect(summaryMonth('notes.md').ok).toBe(false)
    expect(summaryMonth('2026-10-19.md.bak').ok).toBe(false)
  })
})

describe('planSessionSummaryOrganization', () => {
  test('plans buckets by month and leaves documentation alone', () => {
    const root = scratch()
    write(root, '2026-10-01-first.md')
    write(root, '2026-10-19-second.md')
    write(root, '2026-07-31-legacy-month.md')
    write(root, '2026-07-31-gates.log')
    write(root, '2026-0721-1800.md')
    write(root, 'README.md')
    write(root, '.gitkeep', '')
    write(root, 'handwritten-note.md')

    const plan = planSessionSummaryOrganization(root)

    expect(plan.moves.map((move) => move.target)).toEqual([
      '2026-07/2026-07-31-gates.log',
      '2026-07/2026-07-31-legacy-month.md',
      '2026-07/2026-0721-1800.md',
      '2026-10/2026-10-01-first.md',
      '2026-10/2026-10-19-second.md',
    ])
    expect(plan.undated).toEqual(['handwritten-note.md'])
    expect(plan.conflicts).toEqual([])
    // Planning never mutates.
    expect(fs.readdirSync(root).sort()).toContain('2026-10-01-first.md')
  })

  test('reports an existing destination as a conflict and never overwrites it', () => {
    const root = scratch()
    write(root, '2026-10-19-busy.md')
    fs.mkdirSync(path.join(root, '2026-10'))
    fs.writeFileSync(
      path.join(root, '2026-10', '2026-10-19-busy.md'),
      'keep me\n',
    )

    const report = organizeSessionSummaries(root)

    expect(report.conflicts).toEqual([
      { file: '2026-10-19-busy.md', target: '2026-10/2026-10-19-busy.md' },
    ])
    expect(report.applied).toBe(0)
    expect(
      fs.readFileSync(path.join(root, '2026-10-19-busy.md'), 'utf8'),
    ).toContain('busy')
    expect(
      fs.readFileSync(path.join(root, '2026-10', '2026-10-19-busy.md'), 'utf8'),
    ).toBe('keep me\n')
  })
})

describe('sessionSummaryReference', () => {
  test('follows a cited flat summary into its month bucket', () => {
    const root = scratch()
    fs.mkdirSync(path.join(root, 'dev', 'session-summaries', '2026-10'), {
      recursive: true,
    })
    fs.writeFileSync(
      path.join(
        root,
        'dev',
        'session-summaries',
        '2026-10',
        '2026-10-18-picker.md',
      ),
      '# picker\n',
    )

    expect(
      sessionSummaryReference(
        root,
        'dev/session-summaries/2026-10-18-picker.md',
      ),
    ).toBe('dev/session-summaries/2026-10/2026-10-18-picker.md')
  })

  test('leaves a path alone when the flat file still exists or the name is unplaceable', () => {
    const root = scratch()
    fs.mkdirSync(path.join(root, 'dev', 'session-summaries'), {
      recursive: true,
    })
    fs.writeFileSync(
      path.join(root, 'dev', 'session-summaries', '2026-10-18-flat.md'),
      '# flat\n',
    )

    expect(
      sessionSummaryReference(root, 'dev/session-summaries/2026-10-18-flat.md'),
    ).toBe('dev/session-summaries/2026-10-18-flat.md')
    expect(
      sessionSummaryReference(root, 'dev/session-summaries/notes.md'),
    ).toBe('dev/session-summaries/notes.md')
    expect(
      sessionSummaryReference(root, 'dev/session-summaries/../secret.md'),
    ).toBe('dev/session-summaries/../secret.md')
    expect(sessionSummaryReference(root, 'docs/2026-10-18-other.md')).toBe(
      'docs/2026-10-18-other.md',
    )
  })
})

describe('organizeSessionSummaries', () => {
  test('moves each summary into its month bucket and keeps names', () => {
    const root = scratch()
    write(root, '2026-09-30-closeout.md')
    write(root, '2026-10-01-open.md')
    write(root, '2026-0823-2328-handoff.md')
    write(root, 'README.md')
    write(root, '.gitkeep', '')

    const report = organizeSessionSummaries(root)

    expect(report.applied).toBe(3)
    expect(report.moves).toHaveLength(3)
    expect(fs.readdirSync(path.join(root, '2026-10'))).toEqual([
      '2026-10-01-open.md',
    ])
    expect(fs.readdirSync(path.join(root, '2026-09'))).toEqual([
      '2026-09-30-closeout.md',
    ])
    expect(fs.readdirSync(path.join(root, '2026-08'))).toEqual([
      '2026-0823-2328-handoff.md',
    ])
    expect(fs.readdirSync(root).sort()).toEqual([
      '.gitkeep',
      '2026-08',
      '2026-09',
      '2026-10',
      'README.md',
    ])
    expect(sessionSummaryOrganizationLine(report)).toBe(
      'session-summaries: 3 summary file(s) grouped into 3 month bucket(s).',
    )
  })

  test('is idempotent and reports nothing on a grouped directory', () => {
    const root = scratch()
    write(root, '2026-10-01-open.md')
    organizeSessionSummaries(root)

    const second = organizeSessionSummaries(root)

    expect(second.moves).toEqual([])
    expect(second.applied).toBe(0)
    expect(sessionSummaryOrganizationLine(second)).toBeNull()
  })

  test('dry runs report the plan without moving anything', () => {
    const root = scratch()
    write(root, '2026-10-01-open.md')

    const report = organizeSessionSummaries(root, { dryRun: true })

    expect(report.moves).toHaveLength(1)
    expect(report.applied).toBe(0)
    expect(fs.existsSync(path.join(root, '2026-10-01-open.md'))).toBe(true)
    expect(fs.existsSync(path.join(root, '2026-10'))).toBe(false)
  })

  test('a missing directory is a clean no-op', () => {
    const root = path.join(scratch(), 'absent')
    const report = organizeSessionSummaries(root)
    expect(report.applied).toBe(0)
    expect(report.moves).toEqual([])
  })

  test('the report line names conflicts and undated files', () => {
    const root = scratch()
    write(root, '2026-10-19-busy.md')
    write(root, 'notes.md')
    fs.mkdirSync(path.join(root, '2026-10'))
    fs.writeFileSync(path.join(root, '2026-10', '2026-10-19-busy.md'), 'keep\n')

    const report = organizeSessionSummaries(root)
    const line = sessionSummaryOrganizationLine(report)

    expect(line).toContain('a month bucket already holds the same name')
  })
})

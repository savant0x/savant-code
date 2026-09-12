import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { createSkill } from '@savant-code/common/util/skill-management'

import { computeRecurrences } from '../experiences-dedup'
import {
  AGENDA_MAX_ITEMS,
  AGENDA_MAX_LINES,
  buildAgenda,
  runSessionEndReview,
} from '../session-end-review'

import type { ExperienceRecord } from '@savant-code/common/types/experience'

const tempDirectories: string[] = []

function fixtureRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-end-'))
  tempDirectories.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

const MS_PER_DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 7, 24, 12)

const BODY = `# Test Skill\n\n## When to Use\nx\n\n## Procedure\n1. y\n\n## Pitfalls\n- z\n\n## Verification\nrun\n`

function record(
  tool: string,
  error: string,
  daysAgo: number,
): ExperienceRecord {
  return {
    ts: new Date(NOW - daysAgo * MS_PER_DAY).toISOString(),
    triggerType: 'tool_failure',
    toolName: tool,
    errorFirstLine: error,
    contextHash: '0'.repeat(64),
    sessionId: 's',
  }
}

describe('buildAgenda (S3-A)', () => {
  test('lists only the top recurring patterns, capped', () => {
    const records = [
      record('run_command', 'boom one', 1),
      record('run_command', 'boom one', 2),
      record('run_command', 'boom one', 3),
      record('web_search', 'timeout', 1),
      record('web_search', 'timeout', 2),
      record('web_search', 'timeout', 3),
      record('read_files', 'ENOENT', 1),
      record('read_files', 'ENOENT', 2),
      record('read_files', 'ENOENT', 3),
      record('glob', 'odd', 1),
      record('glob', 'odd', 2),
      record('glob', 'odd', 3),
    ]
    const recurrences = computeRecurrences(records, { now: NOW })
    const built = buildAgenda(recurrences)
    expect(built.items.length).toBeLessThanOrEqual(AGENDA_MAX_ITEMS)
    const lines = built.agenda.split('\n')
    expect(lines.length).toBeLessThanOrEqual(AGENDA_MAX_LINES)
  })

  test('empty ledger yields a no-patterns agenda under the cap', () => {
    const built = buildAgenda([])
    expect(built.items).toEqual([])
    expect(built.agenda).toContain('No recurring failure patterns')
    expect(built.agenda.split('\n').length).toBeLessThanOrEqual(
      AGENDA_MAX_LINES,
    )
  })

  test('routing notes name FID candidates per hybrid routing', () => {
    const records = [
      record('run_command', 'tsc: command not found', 1),
      record('run_command', 'tsc: command not found', 2),
      record('run_command', 'tsc: command not found', 3),
    ]
    const built = buildAgenda(computeRecurrences(records, { now: NOW }))
    expect(built.routing[0]).toContain('FID-route')
    expect(built.routing[0]).toContain('Orchestrator direct write')
  })
})

describe('runSessionEndReview', () => {
  test('writes dev/agenda.md from the ledger', () => {
    const root = fixtureRoot()
    fs.mkdirSync(path.join(root, 'dev', 'experiences'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'dev', 'experiences', 'raw-traces.jsonl'),
      [
        JSON.stringify(record('run_command', 'boom', 1)),
        JSON.stringify(record('run_command', 'boom', 2)),
        JSON.stringify(record('run_command', 'boom', 3)),
      ].join('\n') + '\n',
      'utf8',
    )
    // Inject the fixture's frozen clock — runSessionEndReview forwards `now`
    // to the 14-day recurrence window, so the fixture records stay in-window
    // regardless of the real date (date-bomb guard).
    const review = runSessionEndReview(root, { now: NOW })
    const agenda = fs.readFileSync(path.join(root, 'dev', 'agenda.md'), 'utf8')
    expect(review.items).toHaveLength(1)
    expect(agenda).toContain('run_command')
  })

  test('creates the agenda even when no ledger exists', () => {
    const root = fixtureRoot()
    const review = runSessionEndReview(root)
    expect(review.items).toEqual([])
    expect(fs.existsSync(path.join(root, 'dev', 'agenda.md'))).toBe(true)
  })

  test('prints the quarantine alert when drafts pend (FID-2026-0910-001 P3)', () => {
    const root = fixtureRoot()
    const created = createSkill({
      rootDir: root,
      name: 'pending-alert',
      description: 'draft to alert on',
      body: BODY,
      sessionId: 's',
      reason: 'r',
    })
    expect(created.ok).toBe(true)
    const review = runSessionEndReview(root)
    expect(
      review.routing.some((note) =>
        note.includes('1 quarantined skill draft pending operator review'),
      ),
    ).toBe(true)
  })

  test('quarantine alert is silent when no drafts pend', () => {
    const root = fixtureRoot()
    fs.mkdirSync(path.join(root, 'dev', 'experiences'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'dev', 'experiences', 'raw-traces.jsonl'),
      [
        JSON.stringify(record('run_command', 'boom', 1)),
        JSON.stringify(record('run_command', 'boom', 2)),
        JSON.stringify(record('run_command', 'boom', 3)),
      ].join('\n') + '\n',
      'utf8',
    )
    const review = runSessionEndReview(root, { now: NOW })
    expect(
      review.routing.some((note) => note.includes('quarantined skill draft')),
    ).toBe(false)
  })

  test('FID-2026-0912-003 P2 (RED): the review writes one wiki page per promoted pattern', () => {
    const root = fixtureRoot()
    fs.mkdirSync(path.join(root, 'dev', 'experiences'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'dev', 'experiences', 'raw-traces.jsonl'),
      [
        JSON.stringify(record('run_command', 'boom', 1)),
        JSON.stringify(record('run_command', 'boom', 2)),
        JSON.stringify(record('run_command', 'boom', 3)),
      ].join('\n') + '\n',
      'utf8',
    )
    const review = runSessionEndReview(root, { now: NOW })
    expect(review.wikiPages).toBe(1)
    const review2 = runSessionEndReview(root, { now: NOW })
    expect(review2.wikiPages).toBe(0) // idempotent re-review
    const files = fs.readdirSync(path.join(root, 'dev', 'wiki', 'patterns'))
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(/^run-command-[0-9a-f]{12}\.md$/)
  })

  test('FID-2026-0912-003 P2 (RED): the wiki is never boot-read (no import into agent runtime surfaces)', () => {
    // Structural pin: the wiki module must not be imported by anything the
    // agent runtime loads at boot. The only legitimate consumers are the
    // session-end script and (future) the isolated proposer.
    const runtimeFiles = [
      'packages/agent-runtime/src/index.ts',
      'common/src/util/skill-management/index.ts',
    ]
    for (const rel of runtimeFiles) {
      const abs = path.join(import.meta.dir, '..', '..', rel)
      if (!fs.existsSync(abs)) continue
      const src = fs.readFileSync(abs, 'utf8')
      expect(src).not.toContain('skill-wiki')
    }
  })
})

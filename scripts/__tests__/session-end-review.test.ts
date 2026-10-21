import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { createSkill } from '@savant-code/common/util/skill-management'

import { computeRecurrences } from '../experiences-dedup'
import {
  AGENDA_MAX_ITEMS,
  AGENDA_MAX_LINE,
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

/**
 * FID-2026-1003-007 — a scratch root whose SCOPE.md holds exactly the given
 * open-item lines, plus the review run over it. The register header is
 * identical in every case; only the items differ.
 */
function reviewRegister(
  items: string[],
): ReturnType<typeof runSessionEndReview> {
  const root = fixtureRoot()
  fs.writeFileSync(
    path.join(root, 'SCOPE.md'),
    ['# SCOPE', '', '## Open items', '', ...items].join('\n'),
    'utf8',
  )
  return runSessionEndReview(root)
}

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

  test('a class recurrence names the class and marks the exemplar', () => {
    // Three DIFFERENT exit-failure messages collapse into one `command-exit`
    // class. The 2026-10-20 defect this pins: the agenda printed the first
    // specimen beside the class total, so `head: command not found` (5 real
    // rows) read as "recurred 69×". The counted unit must be stated.
    const records = [
      record(
        'run_readonly_command',
        'Command exited with code 127: /usr/bin/bash: line 1: head: command not found',
        1,
      ),
      record(
        'run_readonly_command',
        'Command exited with code 2: rg: bad flag',
        2,
      ),
      record(
        'run_readonly_command',
        'Command exited with code 1: grep: no match',
        3,
      ),
    ]
    const recurrences = computeRecurrences(records, { now: NOW })
    expect(recurrences).toHaveLength(1)
    expect(recurrences[0]?.cause).toBe('command-exit')
    expect(recurrences[0]?.count).toBe(3)
    const built = buildAgenda(recurrences)
    expect(built.items[0]?.cause).toBe('command-exit')
    expect(built.agenda).toContain('command-exit ×3')
    expect(built.agenda).toContain('class recurrence (total 3)')
    expect(built.agenda).toContain('count spans the class')
    expect(built.agenda).toContain('e.g. Command exited with code 127')
    expect(built.routing[0]).toContain('command-exit ×3')
    expect(built.routing[0]).toContain('counted across the class')
    for (const line of built.agenda.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(AGENDA_MAX_LINE)
    }
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

  test('FID-2026-1003-007: register items blocked on a ruling are surfaced in the agenda + routing', () => {
    const review = reviewRegister([
      '- [ ] **T999. Some operator-gated thing.**',
      '      Prose line one.',
      '      **Blocker:** widening a security control is an operator ruling.',
      '      **Automation level: 1.**',
      '',
      '- [ ] **T998. Already-decided thing without a blocker.**',
      '      No blocker sentence here.',
    ])
    expect(review.decisions).toHaveLength(1)
    expect(review.decisions[0]?.id).toBe('T999')
    expect(review.agenda).toContain('## Pending operator decisions')
    expect(review.agenda).toContain('**T999**')
    expect(review.agenda).toContain('blocker: widening a security control')
    expect(review.agenda).not.toContain('T998')
    expect(
      review.routing.some((note) => note.startsWith('PRESENT: T999')),
    ).toBe(true)
  })

  test('FID-2026-1003-007: an item that quotes the convention is not a decision', () => {
    // The live first run surfaced FID-2026-1003-007's own register entry as a
    // pending decision: the item *documents* the convention by quoting
    // `**Blocker:**` mid-sentence, and the parser read the quotation as a
    // declaration. A mechanism item must never ask the operator for a ruling it
    // is itself delivering.
    const review = reviewRegister([
      '- [ ] **FID-2026-1003-007. Decisions are surfaced mechanically.** The',
      '      failure: register items sat `**Blocker:** operator ruling` for',
      '      weeks because nothing presented them.',
      '      **FID:** `FID-2026-1003-007`. **Automation level: 3** for the',
      '      mechanism.',
      '',
      '- [ ] **T996. A genuinely blocked item.**',
      '      Prose line one.',
      '      **Blocker:** operator ruling required.',
    ])
    expect(review.decisions).toHaveLength(1)
    expect(review.decisions[0]?.id).toBe('T996')
    expect(review.decisions[0]?.blocker).toBe('operator ruling required.')
    expect(
      review.routing.some((note) => note.includes('FID-2026-1003-007')),
    ).toBe(false)
  })

  test('FID-2026-1003-007: decision lines respect the markdown line-length bound', () => {
    // A fixed 110-char blocker budget plus its 15-char prefix rendered 125
    // columns and failed `lint:md` (MD013) on the live register. The budget is
    // now the remainder after each line's own prefix, and an over-long id must
    // shorten the summary instead of overflowing the line.
    const review = reviewRegister([
      '- [ ] **T62-followups-extra-long-identifier. Item.**',
      '      Prose line one that runs on and on and on and should be truncated.',
      '      **Blocker:** operator credits and keys, which are external to the',
      '      repository and cannot be resolved from inside it at all.',
    ])
    expect(review.decisions).toHaveLength(1)
    for (const line of review.agenda.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(120)
    }
  })

  test('FID-2026-1003-007: a register with no blocked items stays silent', () => {
    const review = reviewRegister([
      '- [ ] **T997. Unblocked thing.** No blocker.',
    ])
    expect(review.decisions).toEqual([])
    expect(review.agenda).not.toContain('Pending operator decisions')
    expect(review.routing.some((note) => note.startsWith('PRESENT:'))).toBe(
      false,
    )
  })
})

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  draftCandidates,
  draftDescription,
  findCandidates,
} from '../lessons-to-skills'

import type { ExperienceRecord } from '@savant-code/common/types/experience'

/**
 * draftCandidates quarantine/proposal/event-contract pins (file split —
 * lessons-to-skills.test.ts sat at the 300-line quality-ratchet cap).
 *
 * The `draftCandidates` block and its fixture helpers were moved verbatim
 * from lessons-to-skills.test.ts (FID-2026-0914-001 split precedent).
 */

const tempDirectories: string[] = []

function fixtureRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'l2s-'))
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

function record(
  tool: string,
  error: string,
  daysAgo: number,
  sessionId = 's1',
): ExperienceRecord {
  return {
    ts: new Date(NOW - daysAgo * MS_PER_DAY).toISOString(),
    triggerType: 'tool_failure',
    toolName: tool,
    errorFirstLine: error,
    contextHash: '0'.repeat(64),
    sessionId,
  }
}

function writeLedger(root: string, records: ExperienceRecord[]): void {
  fs.mkdirSync(path.join(root, 'dev', 'experiences'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'dev', 'experiences', 'raw-traces.jsonl'),
    records.map((r) => JSON.stringify(r)).join('\n') + '\n',
    'utf8',
  )
}

const LESSON_TEMPLATE = `## Lesson: Environment-dependent guards need live probes

- **Date:** 2026-08-23
- **Failure:** A guard matcher depended on launch-environment state.
- **Evidence:**
  packages/agent-runtime/src/echo/path-canonicalization.ts → symbol:canonicalizePath,
  packages/agent-runtime/src/tools/handlers/tool/__tests__/recorder-stall-check.test.ts → test:counts
- **Invariant:** A guard matcher must never depend on launch-environment state.
- **Guard:** Path-classification helpers match intrinsic segments or suffixes;
  any environment-derived anchor requires an injected seam or a live probe.
- **Verification:** typecheck exit 0; focused suites pass.
- **Scope:** internal
- **Owning FID:** FID-2026-0823-014
- **Status:** active
- **Canonical rule:** no-environment-dependent-guards
`

function writeRuleCatalog(root: string, extraClasses: string[] = []): void {
  const classes = [
    'v1:run_command:incomplete-arguments:unexpected',
    ...extraClasses,
  ]
  fs.writeFileSync(
    path.join(root, 'dev', 'LEARNING-RULES.md'),
    `# Canonical rules

## Rule: no-environment-dependent-guards

- **Authority:** fixture.ts
- **Validation:** fixture test
- **Tier:** reference
- **Tier reason:** fixture-only explicit class mapping
- **Failure classes:** ${classes.join(', ')}
`,
    'utf8',
  )
}

function writeLesson(root: string): void {
  fs.mkdirSync(path.join(root, 'dev'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'dev', 'LEARNINGS.md'),
    `# LEARNINGS\n\n${LESSON_TEMPLATE}`,
    'utf8',
  )
}

describe('draftCandidates', () => {
  test('drafts an eligible candidate into quarantine with the proposal + event contract', () => {
    const root = fixtureRoot()
    writeLedger(root, [
      record(
        'run_command',
        'Incomplete arguments for tool run_command: missing guard',
        1,
        's1',
      ),
      record(
        'run_command',
        'Incomplete arguments for tool run_command: missing guard',
        2,
        's2',
      ),
      record(
        'run_command',
        'Incomplete arguments for tool run_command: missing guard',
        3,
        's3',
      ),
    ])
    fs.mkdirSync(path.join(root, 'dev'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'dev', 'LEARNINGS.md'),
      `# LEARNINGS\n\n${LESSON_TEMPLATE}`,
      'utf8',
    )
    writeRuleCatalog(root)
    // Inject the fixture's frozen clock — draftCandidates forwards `now` to
    // the 14-day recurrence window, so the Aug 21–23 fixture records stay
    // in-window regardless of the real date (date-bomb guard).
    const drafted = draftCandidates(root, { now: NOW })
    expect(drafted.length).toBeGreaterThan(0)
    const name = drafted[0]
    const draftDir = path.join(root, '.agents', 'skills', '.quarantine', name)
    expect(fs.existsSync(path.join(draftDir, 'SKILL.md'))).toBe(true)
    // NOT in the live skills dir.
    expect(
      fs.existsSync(path.join(root, '.agents', 'skills', name, 'SKILL.md')),
    ).toBe(false)
    // FID-2026-1005-003 Steps 2–4: the proposal slot was reserved BEFORE the
    // write, the draft body carries the CANONICAL RULE (not a generic
    // template), and one mutation-boundary lifecycle event was emitted.
    const proposals = JSON.parse(
      fs.readFileSync(
        path.join(root, '.savant', 'skill-proposals.json'),
        'utf8',
      ),
    ) as Array<{ skillName: string; sessionId: string }>
    expect(proposals).toHaveLength(1)
    expect(proposals[0].skillName).toBe(name)
    const skillBody = fs.readFileSync(path.join(draftDir, 'SKILL.md'), 'utf8')
    expect(skillBody).toContain('no-environment-dependent-guards')
    const events = fs
      .readFileSync(
        path.join(root, '.savant', 'skill-lifecycle-events.jsonl'),
        'utf8',
      )
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { action: string; skillName: string })
    expect(events).toHaveLength(1)
    expect(events[0].action).toBe('draft_created')
    expect(events[0].skillName).toBe(name)
  })

  test('a second distinct proposal for the same session fails closed (no double draft)', () => {
    const root = fixtureRoot()
    writeLedger(root, [
      record(
        'run_command',
        'Incomplete arguments for tool run_command: missing guard',
        1,
        's1',
      ),
      record(
        'run_command',
        'Incomplete arguments for tool run_command: missing guard',
        2,
        's2',
      ),
      record(
        'run_command',
        'Incomplete arguments for tool run_command: missing guard',
        3,
        's3',
      ),
    ])
    fs.mkdirSync(path.join(root, 'dev'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'dev', 'LEARNINGS.md'),
      `# LEARNINGS\n\n${LESSON_TEMPLATE}`,
      'utf8',
    )
    writeRuleCatalog(root)
    const first = draftCandidates(root, { now: NOW })
    expect(first.length).toBeGreaterThan(0)
    // A second pass in the SAME session: the slot is taken, nothing new is
    // drafted and no extra proposal record exists.
    const second = draftCandidates(root, { now: NOW })
    expect(second).toEqual([])
    const proposals = JSON.parse(
      fs.readFileSync(
        path.join(root, '.savant', 'skill-proposals.json'),
        'utf8',
      ),
    ) as unknown[]
    expect(proposals).toHaveLength(1)
  })

  test('carries the LESSON into the draft, not the failure text (FID-2026-1016-015)', () => {
    const root = fixtureRoot()
    writeLedger(root, [
      record(
        'run_command',
        'Incomplete arguments for tool run_command: missing guard',
        1,
        's1',
      ),
      record(
        'run_command',
        'Incomplete arguments for tool run_command: missing guard',
        2,
        's2',
      ),
      record(
        'run_command',
        'Incomplete arguments for tool run_command: missing guard',
        3,
        's3',
      ),
    ])
    writeLesson(root)
    writeRuleCatalog(root)
    const drafted = draftCandidates(root, { now: NOW })
    expect(drafted).toHaveLength(1)
    const skillBody = fs.readFileSync(
      path.join(
        root,
        '.agents',
        'skills',
        '.quarantine',
        drafted[0],
        'SKILL.md',
      ),
      'utf8',
    )
    // The description is the RULE, not the error line sliced at 60 chars —
    // that slice is what cut the real quarantined draft mid-word
    // ("retry the tool cal") and taught the failure message as the rule.
    expect(skillBody).toContain('description: no environment dependent guards')
    expect(skillBody).not.toContain('description: Incomplete arguments')
    // The lesson's own invariant and guard are the procedure.
    expect(skillBody).toContain(
      '1. A guard matcher must never depend on launch-environment state.',
    )
    expect(skillBody).toContain(
      '2. Path-classification helpers match intrinsic segments or suffixes; any environment-derived anchor requires an injected seam or a live probe.',
    )
  })

  test('aggregates one candidate and one proposal per lesson rule', () => {
    const root = fixtureRoot()
    // Two distinct recurrence rows (different error text ⇒ different dedup
    // key) that both map to the same rule — the shape that used to emit one
    // candidate and one proposal per row for a single lesson.
    const first = 'Incomplete arguments for tool run_command: missing guard'
    const second = 'Incomplete arguments for tool run_command: missing target'
    writeLedger(root, [
      record('run_command', first, 1, 's1'),
      record('run_command', first, 2, 's2'),
      record('run_command', first, 3, 's3'),
      record('run_command', second, 1, 's1'),
      record('run_command', second, 2, 's2'),
      record('run_command', second, 3, 's3'),
    ])
    writeLesson(root)
    writeRuleCatalog(root)
    const candidates = findCandidates(root, { now: NOW })
    expect(candidates).toHaveLength(1)
    expect(candidates[0].count).toBe(6)
    expect(candidates[0].distinctSessions).toBe(3)
    const drafted = draftCandidates(root, { now: NOW })
    expect(drafted).toHaveLength(1)
    const proposals = JSON.parse(
      fs.readFileSync(
        path.join(root, '.savant', 'skill-proposals.json'),
        'utf8',
      ),
    ) as unknown[]
    expect(proposals).toHaveLength(1)
  })

  test('clips the description at a word boundary, never mid-word', () => {
    const description = draftDescription(
      'A library-complete hand-off needs a named consumer, not a readiness note',
      'library-complete-needs-a-named-consumer',
    )
    expect(description).toBe('library complete needs a named consumer')
    expect(description.length).toBeLessThanOrEqual(60)
    // A rule whose words cannot fit still ends on a whole word.
    const long = draftDescription(
      '',
      'alpha-bravo-charlie-delta-echo-foxtrot-golf',
    )
    expect(long.endsWith(' ')).toBe(false)
    expect(long).toBe(
      'alpha bravo charlie delta echo foxtrot golf'.slice(0, long.length),
    )
  })

  test('does not draft when the lesson is below the non-obvious bar', () => {
    const root = fixtureRoot()
    writeLedger(root, [
      record('run_command', 'some pattern', 1),
      record('run_command', 'some pattern', 2),
      record('run_command', 'some pattern', 3),
    ])
    fs.mkdirSync(path.join(root, 'dev'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'dev', 'LEARNINGS.md'),
      `# LEARNINGS\n\n## Lesson: Thin lesson\n\n- **Date:** 2026-08-20\n- **Failure:** x.\n- **Evidence:** a.ts → symbol:f\n- **Invariant:** i.\n- **Guard:** short guard.\n- **Verification:** v.\n- **Scope:** internal\n- **Owning FID:** FID-2026-0801-001\n- **Status:** active\n- **Canonical rule:** some-pattern-rule\n`,
      'utf8',
    )
    const drafted = draftCandidates(root)
    expect(drafted).toEqual([])
  })
})

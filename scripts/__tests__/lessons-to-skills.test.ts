import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  draftCandidates,
  findCandidates,
  parseLessons,
  purgeRejectedDrafts,
} from '../lessons-to-skills'

import type { ExperienceRecord } from '@savant-code/common/types/experience'

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

describe('parseLessons', () => {
  test('extracts structured fields', () => {
    const entries = parseLessons(`# LEARNINGS\n\n${LESSON_TEMPLATE}`)
    expect(entries).toHaveLength(1)
    expect(entries[0].canonicalRule).toBe('no-environment-dependent-guards')
    expect(entries[0].evidenceCount).toBe(2)
    expect(entries[0].status).toBe('active')
  })
})

describe('findCandidates (S3-B extraction criteria)', () => {
  test('flags a matching recurring pattern as eligible', () => {
    const root = fixtureRoot()
    writeLedger(root, [
      record('run_command', 'guard depends on launch environment state', 1),
      record('run_command', 'guard depends on launch environment state', 2),
      record('run_command', 'guard depends on launch environment state', 3),
    ])
    fs.mkdirSync(path.join(root, 'dev'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'dev', 'LEARNINGS.md'),
      `# LEARNINGS\n\n${LESSON_TEMPLATE}`,
      'utf8',
    )
    const candidates = findCandidates(root, { now: NOW })
    expect(candidates).toHaveLength(1)
    expect(candidates[0].reasons).toEqual([])
  })

  test('below-frequency patterns are not candidates', () => {
    const root = fixtureRoot()
    writeLedger(root, [
      record('run_command', 'guard depends on launch environment state', 1),
      record('run_command', 'guard depends on launch environment state', 2),
    ])
    fs.mkdirSync(path.join(root, 'dev'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'dev', 'LEARNINGS.md'),
      `# LEARNINGS\n\n${LESSON_TEMPLATE}`,
      'utf8',
    )
    expect(findCandidates(root, { now: NOW })).toHaveLength(0)
  })
})

describe('draftCandidates', () => {
  test('drafts an eligible candidate into quarantine only', () => {
    const root = fixtureRoot()
    writeLedger(root, [
      record('run_command', 'guard depends on launch environment state', 1),
      record('run_command', 'guard depends on launch environment state', 2),
      record('run_command', 'guard depends on launch environment state', 3),
    ])
    fs.mkdirSync(path.join(root, 'dev'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'dev', 'LEARNINGS.md'),
      `# LEARNINGS\n\n${LESSON_TEMPLATE}`,
      'utf8',
    )
    const drafted = draftCandidates(root)
    expect(drafted.length).toBeGreaterThan(0)
    const draftDir = path.join(
      root,
      '.agents',
      'skills',
      '.quarantine',
      drafted[0],
    )
    expect(fs.existsSync(path.join(draftDir, 'SKILL.md'))).toBe(true)
    // NOT in the live skills dir.
    expect(
      fs.existsSync(
        path.join(root, '.agents', 'skills', drafted[0], 'SKILL.md'),
      ),
    ).toBe(false)
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

describe('purgeRejectedDrafts', () => {
  test('purges only drafts older than the 30-day window', () => {
    const root = fixtureRoot()
    const quarantine = path.join(root, '.agents', 'skills', '.quarantine')
    const oldDir = path.join(quarantine, 'old-draft')
    const freshDir = path.join(quarantine, 'fresh-draft')
    fs.mkdirSync(oldDir, { recursive: true })
    fs.mkdirSync(freshDir, { recursive: true })
    for (const dir of [oldDir, freshDir]) {
      fs.writeFileSync(
        path.join(dir, 'SKILL.md'),
        '---\nname: x\nversion: 0.1.0\ndescription: d\n---\n\nBody\n',
        'utf8',
      )
    }
    const oldTime = new Date(NOW - 40 * MS_PER_DAY)
    fs.utimesSync(path.join(oldDir, 'SKILL.md'), oldTime, oldTime)
    const purged = purgeRejectedDrafts(root, { now: NOW })
    expect(purged).toEqual(['old-draft'])
    expect(fs.existsSync(freshDir)).toBe(true)
  })
})

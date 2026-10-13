import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  archiveRejectedDrafts,
  findCandidates,
  parseLessons,
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

function writeRuleCatalog(root: string): void {
  fs.writeFileSync(
    path.join(root, 'dev', 'LEARNING-RULES.md'),
    `# Canonical rules

## Rule: no-environment-dependent-guards

- **Authority:** fixture.ts
- **Validation:** fixture test
- **Tier:** reference
- **Tier reason:** fixture-only explicit class mapping
- **Failure classes:** v1:run_command:incomplete-arguments:unexpected
`,
    'utf8',
  )
}

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
  test('exact class targeting rejects unrelated, ambiguous, duplicate and historical catalog entries', () => {
    for (const mode of [
      'unrelated',
      'ambiguous',
      'duplicate',
      'historical',
      'retired',
    ]) {
      const root = fixtureRoot()
      writeLedger(
        root,
        ['s1', 's2', 's3'].map((sessionId) =>
          record(
            'run_command',
            'Incomplete arguments for tool run_command: missing guard',
            1,
            sessionId,
          ),
        ),
      )
      fs.writeFileSync(path.join(root, 'dev', 'LEARNINGS.md'), LESSON_TEMPLATE)
      writeRuleCatalog(root)
      const catalogPath = path.join(root, 'dev', 'LEARNING-RULES.md')
      const catalog = fs.readFileSync(catalogPath, 'utf8')
      if (mode === 'unrelated')
        fs.writeFileSync(
          catalogPath,
          catalog.replace(
            'v1:run_command:incomplete-arguments:unexpected',
            'v1:other:incomplete-arguments:unexpected',
          ),
        )
      if (mode === 'ambiguous')
        fs.appendFileSync(
          catalogPath,
          catalog.replace(
            '## Rule: no-environment-dependent-guards',
            '## Rule: another-rule',
          ),
        )
      if (mode === 'duplicate') fs.appendFileSync(catalogPath, catalog)
      if (mode === 'historical')
        fs.writeFileSync(
          catalogPath,
          catalog.replace('- **Tier:** reference', '- **Tier:** historical'),
        )
      if (mode === 'retired') {
        fs.writeFileSync(
          path.join(root, 'dev', 'LEARNINGS.md'),
          '# LEARNINGS\n',
        )
        fs.writeFileSync(
          path.join(root, 'dev', 'LEARNINGS-RETIRED.md'),
          LESSON_TEMPLATE,
        )
      }
      expect(findCandidates(root, { now: NOW })).toEqual([])
    }
  })

  test('flags a matching cross-session recurring pattern as eligible', () => {
    const root = fixtureRoot()
    // FID-2026-1005-003 Step 1: the promotion gate is DISTINCT sessions —
    // the fixture spans three, one occurrence each.
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
    const candidates = findCandidates(root, { now: NOW })
    expect(candidates).toHaveLength(1)
    expect(candidates[0].reasons).toEqual([])
    expect(candidates[0].distinctSessions).toBe(3)
  })

  test('a 3× pattern confined to ONE session is not a candidate (distinct-session gate)', () => {
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
        's1',
      ),
      record(
        'run_command',
        'Incomplete arguments for tool run_command: missing guard',
        3,
        's1',
      ),
    ])
    fs.mkdirSync(path.join(root, 'dev'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'dev', 'LEARNINGS.md'),
      `# LEARNINGS\n\n${LESSON_TEMPLATE}`,
      'utf8',
    )
    writeRuleCatalog(root)
    expect(findCandidates(root, { now: NOW })).toHaveLength(0)
  })

  test('below-frequency patterns are not candidates', () => {
    const root = fixtureRoot()
    writeLedger(root, [
      record(
        'run_command',
        'Incomplete arguments for tool run_command: missing guard',
        1,
      ),
      record(
        'run_command',
        'Incomplete arguments for tool run_command: missing guard',
        2,
      ),
    ])
    fs.mkdirSync(path.join(root, 'dev'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'dev', 'LEARNINGS.md'),
      `# LEARNINGS\n\n${LESSON_TEMPLATE}`,
      'utf8',
    )
    writeRuleCatalog(root)
    expect(findCandidates(root, { now: NOW })).toHaveLength(0)
  })
})

describe('FID-2026-0912-002: purge → archive rename parity', () => {
  test('the expired-draft disposition is move-only (no purge remains)', () => {
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
    const archived = archiveRejectedDrafts(root, { now: NOW })
    expect(archived).toEqual(['old-draft'])
    // The fresh draft is untouched.
    expect(fs.existsSync(freshDir)).toBe(true)
    // The expired draft's bytes SURVIVE in the archive (deletion parity).
    // (This file's NOW is Aug 24 → 40 days back lands in 2026-07.)
    expect(
      fs.existsSync(
        path.join(quarantine, '.archive', '2026-07', 'old-draft', 'SKILL.md'),
      ),
    ).toBe(true)
  })
})

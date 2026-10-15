// skill-management test family — patch + edit semantics (S2-B cap, minor bump).
// Sibling of the Loop 353 decomposition (fixture helpers replicated per
// module to preserve the monolith's isolation semantics).
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  createSkill,
  editSkill,
  patchSkill,
  readLedgerEntries,
  skillVersionsDir,
} from '../skill-management'

const tempDirectories: string[] = []

function fixtureRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-mgmt-'))
  tempDirectories.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

const BODY = `# Test Skill

## When to Use
Use this when...

## Procedure
1. Do the thing.

## Pitfalls
- Watch out.

## Verification
Run the suite.
`

describe('patchSkill (S2-B: patch preferred, 10% cap, patch→patch)', () => {
  test('applies a small patch, bumps patch, snapshots prior state', () => {
    const root = fixtureRoot()
    createSkill({
      rootDir: root,
      name: 'patchy',
      description: 'Patch test skill',
      body: BODY,
      sessionId: 's',
      reason: 'create',
    })
    const result = patchSkill({
      rootDir: root,
      name: 'patchy',
      oldString: '## Pitfalls',
      newString: '## Pitfalls (updated)',
      sessionId: 'sess-2',
      reason: 'clarify pitfalls section',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.version).toBe('0.1.1')

    const entries = readLedgerEntries(root, 'patchy')
    expect(entries).toHaveLength(2)
    expect(entries[1].action).toBe('patch')
    expect(entries[1].version).toBe('0.1.1')
    expect(entries[1].prevSha).toBe(entries[0].nextSha)

    // Prior state snapshot at v2.
    const priorSnapshot = fs.readFileSync(
      path.join(skillVersionsDir(root, 'patchy'), 'v2', 'SKILL.md'),
      'utf8',
    )
    expect(priorSnapshot).toContain('## Pitfalls')
    expect(priorSnapshot).not.toContain('(updated)')
  })

  test('rejects an over-cap patch', () => {
    const root = fixtureRoot()
    createSkill({
      rootDir: root,
      name: 'bigpatch',
      description: 'Big patch test',
      body: BODY,
      sessionId: 's',
      reason: 'create',
    })
    const result = patchSkill({
      rootDir: root,
      name: 'bigpatch',
      oldString: BODY,
      newString: 'x'.repeat(200),
      sessionId: 's',
      reason: 'rewrite via patch',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('cap')
  })

  test('rejects a missing anchor', () => {
    const root = fixtureRoot()
    createSkill({
      rootDir: root,
      name: 'noanchor',
      description: 'Anchor test',
      body: BODY,
      sessionId: 's',
      reason: 'create',
    })
    const result = patchSkill({
      rootDir: root,
      name: 'noanchor',
      oldString: 'this does not exist anywhere',
      newString: 'replacement',
      sessionId: 's',
      reason: 'r',
    })
    expect(result.ok).toBe(false)
  })

  test('rejects patching a nonexistent skill', () => {
    const root = fixtureRoot()
    const result = patchSkill({
      rootDir: root,
      name: 'ghost',
      oldString: 'a',
      newString: 'b',
      sessionId: 's',
      reason: 'r',
    })
    expect(result.ok).toBe(false)
  })
})

describe('editSkill (edit→minor)', () => {
  test('full replace bumps minor', () => {
    const root = fixtureRoot()
    createSkill({
      rootDir: root,
      name: 'editable',
      description: 'Edit test',
      body: BODY,
      sessionId: 's',
      reason: 'create',
    })
    const result = editSkill({
      rootDir: root,
      name: 'editable',
      description: 'Edit test v2',
      body: `# Completely new body\n\n## Procedure\n\nNew steps.\n`,
      sessionId: 'sess-3',
      reason: 'full rewrite',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.version).toBe('0.2.0')
  })
})

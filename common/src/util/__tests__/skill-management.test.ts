// skill-management test family — circuit-breaker math + skill creation.
// Sibling of the Loop 353 decomposition (fixture helpers replicated per
// module to preserve the monolith's isolation semantics).
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  PATCH_MAX_CHANGE_RATIO,
  SKILL_INITIAL_VERSION,
  bumpVersion,
  createSkill,
  levenshteinDistance,
  patchChangeRatio,
  readLedgerEntries,
  skillCanonicalDir,
  skillQuarantineDir,
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

describe('levenshtein + patch ratio (S2-B circuit breaker)', () => {
  test('levenshtein distance basics', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3)
    expect(levenshteinDistance('same', 'same')).toBe(0)
    expect(levenshteinDistance('', 'abc')).toBe(3)
  })

  test('patch ratio caps at the 10% threshold', () => {
    const original = 'a'.repeat(100)
    // 5-char change on 100 chars = 5% (passes)
    expect(
      patchChangeRatio(original, 'b'.repeat(5) + 'a'.repeat(95)),
    ).toBeLessThanOrEqual(PATCH_MAX_CHANGE_RATIO)
    // 50-char change = 50% (fails)
    expect(
      patchChangeRatio(original, 'b'.repeat(50) + 'a'.repeat(50)),
    ).toBeGreaterThan(PATCH_MAX_CHANGE_RATIO)
  })
})

describe('bumpVersion', () => {
  test('bumps each semver kind', () => {
    expect(bumpVersion('0.1.0', 'patch')).toBe('0.1.1')
    expect(bumpVersion('0.1.9', 'minor')).toBe('0.2.0')
    expect(bumpVersion('1.2.3', 'major')).toBe('2.0.0')
  })
  test('rejects malformed versions', () => {
    expect(bumpVersion('abc', 'patch')).toBeNull()
    expect(bumpVersion('0.1', 'patch')).toBeNull()
  })
})

describe('createSkill (S2-B/S2-C)', () => {
  test('lands in quarantine, stamps version + ledger + snapshot', () => {
    const root = fixtureRoot()
    const result = createSkill({
      rootDir: root,
      name: 'release-runner',
      description: 'Runs the release checklist',
      body: BODY,
      sessionId: 'sess-1',
      reason: 'recurring release steps',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.version).toBe(SKILL_INITIAL_VERSION)
    expect(result.pendingTrust).toBe(true)

    // Draft is in quarantine — NOT in the live dir.
    const draftFile = path.join(
      skillQuarantineDir(root, 'release-runner'),
      'SKILL.md',
    )
    expect(fs.existsSync(draftFile)).toBe(true)
    expect(
      fs.existsSync(
        path.join(skillCanonicalDir(root, 'release-runner'), 'SKILL.md'),
      ),
    ).toBe(false)

    // Ledger entry with the full S2-C shape.
    const entries = readLedgerEntries(root, 'release-runner')
    expect(entries).toHaveLength(1)
    const entry = entries[0]
    expect(entry.seq).toBe(1)
    expect(entry.action).toBe('create')
    expect(entry.version).toBe('0.1.0')
    expect(entry.prevSha).toBeNull()
    expect(entry.nextSha).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(entry.provenanceRef).toBe('session:sess-1')
    expect(entry.semanticPreservation).toBe(true)

    // Snapshot v1 exists for rollback.
    expect(
      fs.existsSync(
        path.join(skillVersionsDir(root, 'release-runner'), 'v1', 'SKILL.md'),
      ),
    ).toBe(true)
  })

  test('rejects invalid names and over-long descriptions', () => {
    const root = fixtureRoot()
    expect(
      createSkill({
        rootDir: root,
        name: '.quarantine',
        description: 'x',
        body: BODY,
        sessionId: 's',
        reason: 'r',
      }).ok,
    ).toBe(false)
    expect(
      createSkill({
        rootDir: root,
        name: 'ok-name',
        description: 'x'.repeat(61),
        body: BODY,
        sessionId: 's',
        reason: 'r',
      }).ok,
    ).toBe(false)
  })

  test('rejects duplicates', () => {
    const root = fixtureRoot()
    const first = createSkill({
      rootDir: root,
      name: 'dup-skill',
      description: 'first',
      body: BODY,
      sessionId: 's',
      reason: 'r',
    })
    expect(first.ok).toBe(true)
    const second = createSkill({
      rootDir: root,
      name: 'dup-skill',
      description: 'second',
      body: BODY,
      sessionId: 's',
      reason: 'r',
    })
    expect(second.ok).toBe(false)
  })
})

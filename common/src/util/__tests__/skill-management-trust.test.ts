// skill-management test family — immutability + trust boundary (S2-A/S2-D).
// Sibling of the Loop 353 decomposition (fixture helpers replicated per
// module to preserve the monolith's isolation semantics).
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  createSkill,
  patchSkill,
  rollbackLiveSkill,
  skillCanonicalDir,
  skillQuarantineDir,
  trustSkill,
  untrustSkill,
  writeSnapshot,
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

describe('immutable skills (S2-A)', () => {
  test('mutations are rejected when the live skill is immutable', () => {
    const root = fixtureRoot()
    // Operator places a hand-written immutable skill directly.
    const liveDir = skillCanonicalDir(root, 'governance')
    fs.mkdirSync(liveDir, { recursive: true })
    fs.writeFileSync(
      path.join(liveDir, 'SKILL.md'),
      `---\nname: governance\nversion: 1.0.0\nimmutable: true\ndescription: Non-negotiable governance rules\n---\n\n# Governance\n\nMust never change.\n`,
      'utf8',
    )
    const patch = patchSkill({
      rootDir: root,
      name: 'governance',
      oldString: 'Governance',
      newString: 'Governance (edited)',
      sessionId: 's',
      reason: 'attempted mutation',
    })
    expect(patch.ok).toBe(false)
    if (!patch.ok) expect(patch.error).toContain('immutable')
  })

  test('operator rollback is also rejected for immutable skills', () => {
    const root = fixtureRoot()
    const liveDir = skillCanonicalDir(root, 'governance')
    fs.mkdirSync(liveDir, { recursive: true })
    fs.writeFileSync(
      path.join(liveDir, 'SKILL.md'),
      `---\nname: governance\nversion: 1.0.0\nimmutable: true\ndescription: Non-negotiable governance rules\n---\n\n# Governance\n`,
      'utf8',
    )
    writeSnapshot(root, 'governance', 1, 'snapshot content')
    const rb = rollbackLiveSkill(root, 'governance', 1)
    expect(rb.ok).toBe(false)
  })
})

describe('trust / untrust (S2-D operator boundary)', () => {
  test('trust migrates the draft to live and clears quarantine', () => {
    const root = fixtureRoot()
    createSkill({
      rootDir: root,
      name: 'trustme',
      description: 'To be trusted',
      body: BODY,
      sessionId: 's',
      reason: 'create',
    })
    const result = trustSkill(root, 'trustme')
    expect(result.ok).toBe(true)
    expect(
      fs.existsSync(path.join(skillCanonicalDir(root, 'trustme'), 'SKILL.md')),
    ).toBe(true)
    expect(
      fs.existsSync(path.join(skillQuarantineDir(root, 'trustme'), 'SKILL.md')),
    ).toBe(false)
  })

  test('untrust moves the live copy back to quarantine', () => {
    const root = fixtureRoot()
    createSkill({
      rootDir: root,
      name: 'untrustme',
      description: 'To be untrusted',
      body: BODY,
      sessionId: 's',
      reason: 'create',
    })
    trustSkill(root, 'untrustme')
    const result = untrustSkill(root, 'untrustme')
    expect(result.ok).toBe(true)
    expect(
      fs.existsSync(
        path.join(skillQuarantineDir(root, 'untrustme'), 'SKILL.md'),
      ),
    ).toBe(true)
    expect(
      fs.existsSync(
        path.join(skillCanonicalDir(root, 'untrustme'), 'SKILL.md'),
      ),
    ).toBe(false)
  })

  test('trusting a nonexistent draft fails', () => {
    const root = fixtureRoot()
    expect(trustSkill(root, 'ghost').ok).toBe(false)
  })
})

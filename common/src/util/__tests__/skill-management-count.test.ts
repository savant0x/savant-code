// FID-2026-0910-001 Step 1 pin — engine-owned quarantine draft counter.
// The counter is the single numeric truth for pending drafts; the CLI keeps
// its own presentation rows (Law 13 — one count, one truth).
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  countQuarantinedDrafts,
  createSkill,
  trustSkill,
} from '../skill-management'

const tempDirectories: string[] = []

function fixtureRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-count-'))
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
x

## Procedure
1. y

## Pitfalls
- z

## Verification
run
`

describe('countQuarantinedDrafts (FID-2026-0910-001 P3)', () => {
  test('returns zero when the quarantine root does not exist', () => {
    expect(countQuarantinedDrafts(fixtureRoot())).toBe(0)
  })

  test('counts engine-created drafts; trust decrements the count', () => {
    const root = fixtureRoot()
    expect(countQuarantinedDrafts(root)).toBe(0)

    const first = createSkill({
      rootDir: root,
      name: 'counted-one',
      description: 'first draft',
      body: BODY,
      sessionId: 's',
      reason: 'r',
    })
    expect(first.ok).toBe(true)
    const second = createSkill({
      rootDir: root,
      name: 'counted-two',
      description: 'second draft',
      body: BODY,
      sessionId: 's',
      reason: 'r',
    })
    expect(second.ok).toBe(true)
    expect(countQuarantinedDrafts(root)).toBe(2)

    expect(trustSkill(root, 'counted-one').ok).toBe(true)
    expect(countQuarantinedDrafts(root)).toBe(1)
  })

  test('ignores non-skill entries and SKILL.md-less directories', () => {
    const root = fixtureRoot()
    const quarantineRoot = path.join(root, '.agents', 'skills', '.quarantine')
    // Directory without a SKILL.md — not a draft.
    fs.mkdirSync(path.join(quarantineRoot, 'empty-dir'), { recursive: true })
    // Invalid skill name (uppercase/underscore) — excluded by the name rule.
    fs.mkdirSync(path.join(quarantineRoot, 'Invalid_Name'), {
      recursive: true,
    })
    fs.writeFileSync(
      path.join(quarantineRoot, 'Invalid_Name', 'SKILL.md'),
      '---\nname: Invalid_Name\n---\nx\n',
      'utf8',
    )
    // Stray file at the quarantine root — not a directory, not a draft.
    fs.writeFileSync(path.join(quarantineRoot, 'stray.txt'), 'x', 'utf8')
    expect(countQuarantinedDrafts(root)).toBe(0)
  })
})

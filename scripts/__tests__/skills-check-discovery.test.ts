import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { checkSkillsRoot, discoverSkillDirs } from '../skills-check'

// FID-2026-0928-001 / T95-A: a skill's on-disk version ledger lives in the
// TRUSTED tier (`.agents/skills/<name>/versions/` + `VERSIONS.jsonl`) while its
// content stays in `.quarantine/` until the operator trusts it — git is not the
// ledger. `discoverSkillDirs` returned every directory in the trusted root, so
// such a skill was reported `SKILL.md not found` while simultaneously being
// validated as its quarantined twin. The two facts are the same skill.
//
// Split into its own file because skills-check.test.ts is at 286 of the
// 300-line quality ceiling.

const tempDirectories: string[] = []

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

function fixtureRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-discovery-'))
  tempDirectories.push(root)
  return root
}

/** A trusted-tier skill dir that holds only the on-disk version ledger. */
function writeLedgerOnly(root: string, name: string): void {
  const dir = path.join(root, '.agents', 'skills', name)
  fs.mkdirSync(path.join(dir, 'versions', 'v1'), { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'VERSIONS.jsonl'),
    `${JSON.stringify({ version: 1, sha: 'abc' })}\n`,
  )
}

function writeQuarantined(root: string, name: string): void {
  const dir = path.join(root, '.agents', 'skills', '.quarantine', name)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: short\nversion: 0.1.0\nmetadata:\n  origin: agent\n---\n\n# D\n\n## When to Use\n\nu\n\n## Procedure\n\np\n\n## Pitfalls\n\n- x\n\n## Verification\n\nRun \`bun test\`.\n`,
  )
}

describe('discoverSkillDirs — ledger-only trusted dirs (T95-A)', () => {
  test('skips a ledger-only trusted dir that has a quarantined twin', () => {
    const root = fixtureRoot()
    writeLedgerOnly(root, 'in-flight')
    writeQuarantined(root, 'in-flight')

    const dirs = discoverSkillDirs(path.join(root, '.agents', 'skills'))
    // Exactly one entry, and it is the quarantined twin — not two.
    expect(dirs).toHaveLength(1)
    expect(dirs[0]).toMatchObject({
      entry: 'in-flight',
      quarantined: true,
    })
  })

  test('does not report the ledger-only dir as a missing SKILL.md', () => {
    const root = fixtureRoot()
    writeLedgerOnly(root, 'in-flight')
    writeQuarantined(root, 'in-flight')

    const results = checkSkillsRoot(path.join(root, '.agents', 'skills'))
    expect(results).toHaveLength(1)
    expect(results[0].findings.map((f) => f.rule)).not.toContain('missing')
  })

  test('still reports a ledger-only dir that has NO quarantined twin', () => {
    // Fail-closed: a ledger with no skill and no draft is genuine corruption,
    // not an in-flight trust, and must keep failing.
    const root = fixtureRoot()
    writeLedgerOnly(root, 'orphaned')

    const results = checkSkillsRoot(path.join(root, '.agents', 'skills'))
    const orphaned = results.find((r) => r.entry === 'orphaned')
    expect(orphaned?.findings.map((f) => f.rule)).toContain('missing')
  })

  test('a ledger-only dir does not shadow a real trusted skill of the same name', () => {
    // If the trusted tier DOES have a SKILL.md, the skill is trusted; the
    // quarantined copy is an unrelated pending edit and both are reported.
    const root = fixtureRoot()
    const dir = path.join(root, '.agents', 'skills', 'both')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'SKILL.md'),
      '---\nname: both\ndescription: short\nversion: 0.1.0\n---\n\n# Both\n',
    )
    writeQuarantined(root, 'both')

    const dirs = discoverSkillDirs(path.join(root, '.agents', 'skills'))
    const flags = dirs
      .filter((d) => d.entry === 'both')
      .map((d) => d.quarantined)
      .sort()
    expect(flags).toEqual([false, true])
  })
})

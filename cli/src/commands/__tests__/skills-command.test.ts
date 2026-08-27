import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  createSkill,
  patchSkill,
  trustSkill,
} from '@savant-code/common/util/skill-management'
import { afterEach, describe, expect, test } from 'bun:test'


import { findCommand } from '../command-registry'
import { runSkillsCommand } from '../skills'

const tempDirectories: string[] = []

function fixtureRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-skills-'))
  tempDirectories.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

const BODY = `# Test\n\n## When to Use\nx\n\n## Procedure\n1. y\n\n## Pitfalls\n- z\n\n## Verification\nrun\n`

function seedDraft(root: string, name: string): void {
  const result = createSkill({
    rootDir: root,
    name,
    description: 'A seeded draft skill',
    body: BODY,
    sessionId: 'test-session',
    reason: 'seed for CLI test',
  })
  expect(result.ok).toBe(true)
}

describe('/skills command (FID-2026-0824-012 S0-A/B, S2-E)', () => {
  test('command exists in the registry with the alias', () => {
    const command = findCommand('skills')
    expect(command).toBeDefined()
    expect(command?.name).toBe('skills')
    expect(command?.acceptsArgs).toBe(true)
    expect(findCommand('skill-manage')?.name).toBe('skills')
  })

  test('status shows trusted and quarantined counts', () => {
    const root = fixtureRoot()
    seedDraft(root, 'drafty')
    const trusted = trustSkill(root, 'drafty')
    expect(trusted.ok).toBe(true)
    seedDraft(root, 'pending')

    const output = runSkillsCommand(root, '')
    expect(output).toContain('Trusted: **1**')
    expect(output).toContain('Quarantined (pending trust): **1**')
  })

  test('list separates trusted from quarantined', () => {
    const root = fixtureRoot()
    seedDraft(root, 'alpha')
    seedDraft(root, 'beta')
    trustSkill(root, 'alpha')

    const trusted = runSkillsCommand(root, 'list')
    expect(trusted).toContain('alpha')
    expect(trusted).not.toContain('beta')

    const drafts = runSkillsCommand(root, 'list --quarantined')
    expect(drafts).toContain('beta')
    expect(drafts).not.toContain('alpha')
  })

  test('trust releases a draft; untrust demotes it back', () => {
    const root = fixtureRoot()
    seedDraft(root, 'cycle')

    const trusted = runSkillsCommand(root, 'trust cycle')
    expect(trusted).toContain("trusted 'cycle'")
    expect(
      fs.existsSync(path.join(root, '.agents', 'skills', 'cycle', 'SKILL.md')),
    ).toBe(true)

    const untrusted = runSkillsCommand(root, 'untrust cycle')
    expect(untrusted).toContain("untrusted 'cycle'")
    expect(
      fs.existsSync(
        path.join(root, '.agents', 'skills', '.quarantine', 'cycle', 'SKILL.md'),
      ),
    ).toBe(true)
  })

  test('rollback restores a versioned snapshot into the live copy', () => {
    const root = fixtureRoot()
    seedDraft(root, 'rollcli')
    // Patch the draft, then trust the patched version (0.1.1).
    const patched = patchSkill({
      rootDir: root,
      name: 'rollcli',
      oldString: '## When to Use',
      newString: '## When to Use (patched)',
      sessionId: 'test-session',
      reason: 'patch for rollback test',
    })
    expect(patched.ok).toBe(true)
    const trusted = trustSkill(root, 'rollcli')
    expect(trusted.ok).toBe(true)
    // Snapshot v2 is the PRE-patch content — restore it.
    const rolled = runSkillsCommand(root, 'rollback rollcli 2')
    expect(rolled).toContain("rolled back 'rollcli'")
    const live = fs.readFileSync(
      path.join(root, '.agents', 'skills', 'rollcli', 'SKILL.md'),
      'utf8',
    )
    expect(live).not.toContain('(patched)')
  })

  test('show renders version history', () => {
    const root = fixtureRoot()
    seedDraft(root, 'showname')
    const output = runSkillsCommand(root, 'show showname')
    expect(output).toContain('showname')
    expect(output).toContain('quarantined draft')
    expect(output).toContain('Version history')
  })

  test('unknown skill names produce explicit errors', () => {
    const root = fixtureRoot()
    expect(runSkillsCommand(root, 'trust ghost')).toContain('no quarantined draft')
    expect(runSkillsCommand(root, 'show ghost')).toContain("not found")
    expect(runSkillsCommand(root, 'rollback ghost 1')).toContain('no snapshot')
  })
})

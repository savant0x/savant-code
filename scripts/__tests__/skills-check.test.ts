/**
 * skills:check validator tests (FID-2026-0824-012 S0-C).
 *
 * Covers frontmatter validation, description-length policy (1024 hand-written
 * vs 60 agent-authored), section order, command allowlist + blocklist,
 * line ceiling, version policy, quarantine discovery, and name-mismatch.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  checkSkillContent,
  checkSkillsRoot,
  discoverSkillDirs,
  getDefaultSkillsRoots,
  isAgentAuthored,
} from '../skills-check'

const tempDirectories: string[] = []

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

function fixtureRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-check-'))
  tempDirectories.push(root)
  return root
}

function writeSkill(
  root: string,
  name: string,
  body: string,
  frontmatter: Record<string, unknown> = { description: 'demo skill' },
): string {
  const dir = path.join(root, '.agents', 'skills', name)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 'SKILL.md')
  const meta = frontmatter.metadata
    ? `\nmetadata:\n  ${Object.entries(
        frontmatter.metadata as Record<string, string>,
      )
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n  ')}`
    : ''
  const version =
    frontmatter.version !== undefined ? `\nversion: ${frontmatter.version}` : ''
  fs.writeFileSync(
    file,
    `---\nname: ${name}\ndescription: ${String(frontmatter.description ?? 'demo')}${meta}${version}\n---\n\n${body}`,
  )
  return file
}

function agentSkill(root: string, name: string, body: string): string {
  return writeSkill(root, name, body, {
    description: 'short',
    metadata: { origin: 'agent' },
    version: '0.1.0',
  })
}

const STANDARD_BODY = [
  '# Demo',
  '',
  '## When to Use',
  'Use it when needed.',
  '',
  '## Procedure',
  '1. Step one',
  '',
  '## Pitfalls',
  '- A known trap',
  '',
  '## Verification',
  'Run `bun test`.',
  '',
].join('\n')

describe('checkSkillContent', () => {
  test('accepts a compliant hand-written skill', () => {
    const file = writeSkill(fixtureRoot(), 'demo', STANDARD_BODY)
    const findings = checkSkillContent({
      entry: 'demo',
      filePath: file,
      content: fs.readFileSync(file, 'utf8'),
      quarantined: false,
    })
    // Only a legacy version warning is expected — zero errors.
    expect(findings.filter((f) => f.severity === 'error')).toEqual([])
  })

  test('accepts a compliant agent-authored skill', () => {
    const file = agentSkill(fixtureRoot(), 'demo', STANDARD_BODY)
    const findings = checkSkillContent({
      entry: 'demo',
      filePath: file,
      content: fs.readFileSync(file, 'utf8'),
      quarantined: false,
    })
    expect(findings).toEqual([])
  })

  test('rejects a frontmatter name that does not match the directory', () => {
    const root = fixtureRoot()
    const file = writeSkill(root, 'demo', STANDARD_BODY)
    const content = fs
      .readFileSync(file, 'utf8')
      .replace('name: demo', 'name: other')
    const findings = checkSkillContent({
      entry: 'demo',
      filePath: file,
      content,
      quarantined: false,
    })
    expect(findings.some((f) => f.rule === 'name-mismatch')).toBe(true)
  })

  test('enforces the 60-char description ceiling for agent-authored skills', () => {
    const root = fixtureRoot()
    const longDescription = 'x'.repeat(61)
    const file = writeSkill(root, 'demo', STANDARD_BODY, {
      description: longDescription,
      metadata: { origin: 'agent' },
      version: '0.1.0',
    })
    const findings = checkSkillContent({
      entry: 'demo',
      filePath: file,
      content: fs.readFileSync(file, 'utf8'),
      quarantined: false,
    })
    expect(
      findings.some(
        (f) => f.rule === 'description-length' && f.severity === 'error',
      ),
    ).toBe(true)
  })

  test('allows a 200-char description for hand-written skills', () => {
    const root = fixtureRoot()
    const file = writeSkill(root, 'demo', STANDARD_BODY, {
      description: 'y'.repeat(200),
    })
    const findings = checkSkillContent({
      entry: 'demo',
      filePath: file,
      content: fs.readFileSync(file, 'utf8'),
      quarantined: false,
    })
    expect(findings.some((f) => f.rule === 'description-length')).toBe(false)
  })

  test('requires section order for agent-authored skills', () => {
    const root = fixtureRoot()
    const body = [
      '# Demo',
      '',
      '## Procedure',
      '1. Step',
      '',
      '## When to Use',
      'Use it.',
      '',
    ].join('\n')
    const file = agentSkill(root, 'demo', body)
    const findings = checkSkillContent({
      entry: 'demo',
      filePath: file,
      content: fs.readFileSync(file, 'utf8'),
      quarantined: false,
    })
    const sectionErrors = findings.filter((f) => f.rule === 'section-order')
    expect(sectionErrors.length).toBeGreaterThan(0)
  })

  // FID-2026-0819-005 Loop 187: the blocklist/allowlist/line-ceiling rule
  // tests moved to skills-check-rules.test.ts.

  test('warns on missing version for hand-written and errors for agent-authored', () => {
    const root = fixtureRoot()
    const handWritten = writeSkill(root, 'demo-a', STANDARD_BODY)
    const findingsA = checkSkillContent({
      entry: 'demo-a',
      filePath: handWritten,
      content: fs.readFileSync(handWritten, 'utf8'),
      quarantined: false,
    })
    const versionWarning = findingsA.find((f) => f.rule === 'version')
    expect(versionWarning?.severity).toBe('warning')

    const agentFile = agentSkill(root, 'demo-b', STANDARD_BODY)
    const content = fs
      .readFileSync(agentFile, 'utf8')
      .replace('\nversion: 0.1.0', '')
    const findingsB = checkSkillContent({
      entry: 'demo-b',
      filePath: agentFile,
      content,
      quarantined: false,
    })
    const versionError = findingsB.find((f) => f.rule === 'version')
    expect(versionError?.severity).toBe('error')
  })

  test('rejects a non-semver version', () => {
    const root = fixtureRoot()
    const file = writeSkill(root, 'demo', STANDARD_BODY, { version: 'banana' })
    const findings = checkSkillContent({
      entry: 'demo',
      filePath: file,
      content: fs.readFileSync(file, 'utf8'),
      quarantined: false,
    })
    expect(findings.some((f) => f.rule === 'frontmatter')).toBe(true)
  })
})

describe('isAgentAuthored', () => {
  test('treats quarantined drafts as agent-authored', () => {
    expect(isAgentAuthored({}, true)).toBe(true)
  })
  test('detects metadata.origin agent', () => {
    expect(isAgentAuthored({ metadata: { origin: 'agent' } }, false)).toBe(true)
  })
  test('hand-written stays hand-written', () => {
    expect(isAgentAuthored({ metadata: {} }, false)).toBe(false)
  })
})

describe('discoverSkillDirs + checkSkillsRoot', () => {
  test('discovers active skills and quarantined drafts separately', () => {
    const root = fixtureRoot()
    fs.mkdirSync(path.join(root, '.agents', 'skills', '.quarantine', 'draft'), {
      recursive: true,
    })
    writeSkill(root, 'active-one', STANDARD_BODY)
    const dirs = discoverSkillDirs(path.join(root, '.agents', 'skills'))
    expect(dirs.map((d) => d.entry).sort()).toEqual(['active-one', 'draft'])
    const draft = dirs.find((d) => d.entry === 'draft')
    expect(draft?.quarantined).toBe(true)
  })

  test('rejects a draft failing agent-authored rules via checkSkillsRoot', () => {
    const root = fixtureRoot()
    const draftDir = path.join(
      root,
      '.agents',
      'skills',
      '.quarantine',
      'bad-draft',
    )
    fs.mkdirSync(draftDir, { recursive: true })
    fs.writeFileSync(
      path.join(draftDir, 'SKILL.md'),
      "---\nname: bad-draft\ndescription: '" +
        'too long '.padEnd(90, 'x') +
        "'\nversion: 0.1.0\n---\n\n# D\n\nNot a real skill body.\n",
    )
    const results = checkSkillsRoot(path.join(root, '.agents', 'skills'))
    const draftResult = results.find((r) => r.entry === 'bad-draft')
    expect(draftResult?.quarantined).toBe(true)
    const rules = draftResult?.findings.map((f) => f.rule) ?? []
    expect(rules).toContain('description-length')
    // The unquoted 90-char scalar may also trip frontmatter parsing — both
    // are failures; the description-length rule must be present.
  })
})

describe('getDefaultSkillsRoots', () => {
  test('returns project + home roots with correct precedence order', () => {
    const roots = getDefaultSkillsRoots('/repo')
    expect(roots).toEqual([
      path.join(os.homedir(), '.claude', 'skills'),
      path.join(os.homedir(), '.agents', 'skills'),
      path.join('/repo', '.claude', 'skills'),
      path.join('/repo', '.agents', 'skills'),
    ])
  })
})

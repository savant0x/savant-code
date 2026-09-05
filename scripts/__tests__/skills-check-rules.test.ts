import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { checkSkillContent } from '../skills-check'

// FID-2026-0819-005 Loop 187: the command blocklist/allowlist + line-ceiling
// rule tests split verbatim from skills-check.test.ts (fixture helpers
// copied verbatim so the file is self-contained).

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

describe('checkSkillContent rule specifics', () => {
  test('flags blocklisted shell patterns on any skill', () => {
    const root = fixtureRoot()
    const file = writeSkill(
      root,
      'demo',
      STANDARD_BODY.replace('Run `bun test`.', 'Run `sudo rm -rf /tmp/x`.'),
    )
    const findings = checkSkillContent({
      entry: 'demo',
      filePath: file,
      content: fs.readFileSync(file, 'utf8'),
      quarantined: false,
    })
    expect(findings.some((f) => f.rule === 'command-blocklist')).toBe(true)
  })

  test('flags an unknown command word on agent-authored skills', () => {
    const root = fixtureRoot()
    const file = agentSkill(
      root,
      'demo',
      STANDARD_BODY.replace(
        'Run `bun test`.',
        'Run `evil-mystery-tool --flag`.',
      ),
    )
    const findings = checkSkillContent({
      entry: 'demo',
      filePath: file,
      content: fs.readFileSync(file, 'utf8'),
      quarantined: false,
    })
    expect(
      findings.some(
        (f) =>
          f.rule === 'command-allowlist' &&
          f.message.includes('evil-mystery-tool'),
      ),
    ).toBe(true)
  })

  test('flags the line ceiling', () => {
    const root = fixtureRoot()
    const body = Array.from({ length: 320 }, (_, i) => `line ${i}`).join('\n')
    const file = writeSkill(root, 'demo', body)
    const findings = checkSkillContent({
      entry: 'demo',
      filePath: file,
      content: fs.readFileSync(file, 'utf8'),
      quarantined: false,
    })
    expect(findings.some((f) => f.rule === 'line-ceiling')).toBe(true)
  })
})

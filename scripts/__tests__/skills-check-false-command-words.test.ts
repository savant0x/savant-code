import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { checkSkillContent } from '../skills-check'

// FID-2026-0928-001: `skills:check` reported backticked English prose and fence
// info strings as non-allowlisted shell commands. These legs are split into
// their own file for the same reason skills-check-rules.test.ts was split from
// skills-check.test.ts (FID-2026-0819-005): the quality ceiling is 300 lines and
// the rule file had no room left. Fixture helpers are copied verbatim so the
// file is self-contained.

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

/** Run the rule set over a body and return only the command-allowlist findings. */
function allowlistFindings(root: string, body: string): string[] {
  const file = agentSkill(root, 'demo', body)
  return checkSkillContent({
    entry: 'demo',
    filePath: file,
    content: fs.readFileSync(file, 'utf8'),
    quarantined: false,
  })
    .filter((f) => f.rule === 'command-allowlist')
    .map((f) => f.message)
}

/** A body whose `## Verification` leg is replaced with `replacement`. */
function withVerification(replacement: string): string {
  return STANDARD_BODY.replace('Run `bun test`.', replacement)
}

/** A body with a ```sh fence in the Procedure section. */
function withFence(after: string): string {
  return [
    '# Demo',
    '',
    '## When to Use',
    'Use it when needed.',
    '',
    '## Procedure',
    '```sh',
    'echo hi',
    '```',
    '',
    after,
    '',
    '## Pitfalls',
    '- A known trap',
    '',
    '## Verification',
    'Run `bun test`.',
    '',
  ].join('\n')
}

describe('command-allowlist candidate extraction (FID-2026-0928-001)', () => {
  // RC1: a ``` fence contributes three backticks, which the inline-span regex
  // cannot pair, so it swallows the closing fence and every later inline span is
  // paired off-by-one.
  test('does not report a fence info string as a command', () => {
    const body = [
      '# Demo',
      '',
      '## When to Use',
      'Use it when needed.',
      '',
      '## Procedure',
      '```markdown',
      '## 0.0.30 — 2026-09-08',
      '```',
      '',
      '## Pitfalls',
      '- A known trap',
      '',
      '## Verification',
      'Run `bun test`.',
      '',
    ].join('\n')
    expect(allowlistFindings(fixtureRoot(), body)).toEqual([])
  })

  // RC1, second form: a run of 3+ backticks written *inline* is not a valid
  // inline delimiter either, but is still an odd count that mispairs the rest.
  test('does not report an inline triple-backtick run as a command', () => {
    const body = [
      '# Demo',
      '',
      '## When to Use',
      'Use it when needed.',
      '',
      '## Procedure',
      'Declare gates under a ```markdown fence, not inline.',
      '',
      '## Pitfalls',
      '- A known trap',
      '',
      '## Verification',
      'Run `bun test`.',
      '',
    ].join('\n')
    expect(allowlistFindings(fixtureRoot(), body)).toEqual([])
  })

  // RC1: the mispairing is what produced the false words `with` / `and`. Assert
  // the words *after* the fence stay attributed to their own spans.
  test('keeps inline spans correctly paired after a fence', () => {
    const body = withFence(
      'The root carries `AGENTS.md` with project-specific overrides.',
    )
    const words = allowlistFindings(fixtureRoot(), body)
    expect(words).toEqual([])
    expect(words.some((m) => m.includes('with'))).toBe(false)
  })

  // RC2: a `label: value` span is quoted file content, not a shell line.
  test('does not report a label:value span as a command', () => {
    expect(
      allowlistFindings(
        fixtureRoot(),
        withVerification(
          'Decode `untrusted comment: rsign encrypted secret key` first.',
        ),
      ),
    ).toEqual([])
  })

  test('does not report a bare backticked word as a command', () => {
    expect(
      allowlistFindings(
        fixtureRoot(),
        withVerification(
          'Format with `markdown`, the `CHANGELOG` and `VERSION`.',
        ),
      ),
    ).toEqual([])
  })

  // Regression legs: the narrowing must not stop catching real invocations.
  test('still reports a real command that follows a fence', () => {
    const words = allowlistFindings(
      fixtureRoot(),
      withFence('- Run `evil-mystery-tool --flag`'),
    )
    expect(words.some((m) => m.includes('evil-mystery-tool'))).toBe(true)
  })

  test('still reports a real command that looks like a label', () => {
    const words = allowlistFindings(
      fixtureRoot(),
      withVerification(
        'Run `evil-signing-tool signer generate -w <path>` to make a keypair.',
      ),
    )
    expect(words.some((m) => m.includes('evil-signing-tool'))).toBe(true)
  })

  test('honors the operator-approved Tauri command allowlist', () => {
    expect(
      allowlistFindings(
        fixtureRoot(),
        withVerification(
          'Run `tauri signer generate -w <path>` to make a keypair.',
        ),
      ),
    ).toEqual([])
  })

  test('still reports an allowlisted invocation as clean', () => {
    expect(
      allowlistFindings(
        fixtureRoot(),
        withVerification('Run `bun run typecheck`.'),
      ),
    ).toEqual([])
  })
})

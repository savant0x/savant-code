import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { validateStableReferences } from '../learnings-references'
import { validateReproductionReferences } from '../learnings-reproduction'
import { parseEntry, structuredBlocks } from '../learnings-schema'

import type { StructuredLearning, StableReference } from '../learnings-types'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function git(root: string, args: string[]): string {
  const result = Bun.spawnSync(['git', ...args], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
  return result.stdout.toString().trim()
}

function fixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-reproduction-'))
  roots.push(root)
  git(root, ['init', '-q'])
  fs.mkdirSync(path.join(root, 'scripts'))
  fs.writeFileSync(path.join(root, '.gitignore'), 'ignored.ts\n')
  fs.writeFileSync(
    path.join(root, 'scripts', 'probe.ts'),
    'export function measure() {}\n',
  )
  return root
}

function reference(file = 'scripts/probe.ts'): StableReference {
  return {
    path: file,
    kind: 'symbol',
    target: 'measure',
    raw: `${file} → symbol:measure`,
  }
}

function lesson(
  overrides: Partial<StructuredLearning> = {},
): StructuredLearning {
  return {
    title: 'Reproduction lesson',
    date: '2026-10-13',
    failure: 'Observed failure',
    evidence: [],
    invariant: 'Retain evidence',
    guard: 'Run the durable probe',
    verification: 'Prose is not executable',
    scope: 'internal',
    owningFids: ['FID-2026-1012-013'],
    status: 'active',
    ...overrides,
  }
}

describe('learning reproduction durability', () => {
  test('repository probes resolve while ephemeral, ignored, absent and outside sources fail', () => {
    const root = fixture()
    expect(
      validateReproductionReferences(root, [
        lesson({ reproduction: [reference()] }),
      ]),
    ).toEqual([])
    for (const file of [
      'dev/scratchpad/active/probe.ts',
      'tmp/probe.ts',
      'node_modules/probe.ts',
    ])
      expect(
        validateReproductionReferences(root, [
          lesson({ reproduction: [reference(file)] }),
        ])[0]?.code,
      ).toBe('learning.reproduction.ephemeral')
    fs.writeFileSync(
      path.join(root, 'ignored.ts'),
      'export function measure() {}\n',
    )
    expect(
      validateReproductionReferences(root, [
        lesson({ reproduction: [reference('ignored.ts')] }),
      ])[0]?.code,
    ).toBe('learning.reproduction.unavailable')
    expect(
      validateReproductionReferences(root, [
        lesson({ reproduction: [reference('scripts/missing.ts')] }),
      ])[0]?.code,
    ).toBe('learning.reproduction.unresolved')
    expect(
      validateReproductionReferences(root, [
        lesson({ reproduction: [reference('../outside.ts')] }),
      ])[0]?.code,
    ).toBe('learning.reproduction.unresolved')
  })

  test('historical drift warns only after an actual commit and exact blob target are validated', () => {
    const root = fixture()
    git(root, ['add', '--', 'scripts/probe.ts'])
    git(root, [
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '-qm',
      'fixture snapshot',
    ])
    const commit = git(root, ['rev-parse', 'HEAD'])
    fs.writeFileSync(
      path.join(root, 'scripts', 'probe.ts'),
      'export function renamed() {}\n',
    )
    const historical = lesson({
      status: 'historical',
      asOf: commit,
      evidence: [reference()],
    })
    const warnings = validateStableReferences(root, [historical])
    expect(warnings[0]?.code).toBe('learning.history.live-drift')
    expect(warnings[0]?.severity).toBe('warning')
    expect(warnings[0]?.message).toContain(commit)
    expect(
      validateStableReferences(root, [lesson({ evidence: [reference()] })])[0]
        ?.code,
    ).toBe('learning.evidence.unresolved')
    expect(
      validateStableReferences(root, [
        { ...historical, asOf: '0'.repeat(40) },
      ])[0]?.code,
    ).toBe('learning.history.unresolved')
    expect(
      validateStableReferences(root, [
        { ...historical, evidence: [reference('scripts/missing.ts')] },
      ])[0]?.code,
    ).toBe('learning.history.unresolved')
    expect(
      validateReproductionReferences(root, [
        { ...historical, reproduction: [reference()] },
      ])[0]?.code,
    ).toBe('learning.reproduction.unresolved')
  })

  test('schema rejects malformed reproduction and active historical snapshots', () => {
    const content =
      '- **Reproduction:** run arbitrary prose\n- **As of:** ' +
      'a'.repeat(40) +
      '\n- **Status:** active\n'
    const codes = parseEntry(content, 'Invalid').issues.map(
      (issue) => issue.code,
    )
    expect(codes).toContain('learning.reproduction.invalid')
    expect(codes).toContain('learning.history.invalid')
  })

  test('legacy lessons are governed, remain active and preserve their incident accounts', () => {
    const root = path.resolve(import.meta.dir, '../..')
    const blocks = structuredBlocks(
      fs.readFileSync(path.join(root, 'dev', 'LEARNINGS.md'), 'utf8'),
    )
    for (const title of [
      'Focusable is not reachable — keyboard access needs a control that moves focus',
      'Count-only consumers should not pay for a full parse — derive the count at the source',
      'Reserve proposal slots mechanically — a record store is a cap, prompt discipline is a wish',
    ]) {
      const block = blocks.find((entry) => entry.title === title)
      expect(block).toBeDefined()
      const parsed = parseEntry(block?.block ?? '', title)
      expect(parsed.issues).toEqual([])
      expect(parsed.entry?.status).toBe('active')
      expect(parsed.entry?.scope).toBe('internal')
      expect(parsed.entry?.failure.length).toBeGreaterThan(100)
    }
  })
})

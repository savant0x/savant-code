import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  LEGACY_BOUNDARY,
  LEARNINGS_INSERTION_MARKER,
  validateEmbeddedLearningSource,
  validateLearnings,
} from './learnings-core.js'

const tempDirectories: string[] = []

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

function fixtureRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'learnings-validator-'))
  tempDirectories.push(root)
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'scripts', 'example.ts'),
    'export function example(): void {}\n',
  )
  fs.mkdirSync(path.join(root, 'dev'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'dev', 'LEARNING-RULES.md'),
    '# Rules\n\n## Rule: safe-rule\n',
  )
  return root
}

// Safe Core layout (FID-2026-0916-007): the insertion marker sits in
// governed space — above the legacy boundary — so newly appended entries land
// where the validator checks them.
function validLearning(overrides = ''): string {
  return `# LEARNINGS\n\n${LEARNINGS_INSERTION_MARKER}\n\n## Lesson: Current\n\n- **Date:** 2026-08-11\n- **Failure:** Failure\n- **Evidence:** scripts/example.ts → symbol:example\n- **Invariant:** Invariant\n- **Guard:** Guard\n- **Verification:** Verification\n- **Scope:** internal\n- **Owning FID:** FID-2026-0811-024\n- **Status:** active\n- **Canonical rule:** safe-rule\n${overrides}\n${LEGACY_BOUNDARY}\n`
}

describe('learnings validator', () => {
  test('accepts a structured entry and resolves stable/canonical references', () => {
    const result = validateLearnings(validLearning(), fixtureRoot())
    expect(result.entries).toHaveLength(1)
    expect(result.issues).toEqual([])
  })

  test('rejects missing fields and malformed evidence', () => {
    const content = validLearning()
      .replace('- **Guard:** Guard\n', '')
      .replace('scripts/example.ts → symbol:example', 'scripts/missing.ts')
    const result = validateLearnings(content, fixtureRoot())
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'learning.field.missing',
        'learning.evidence.invalid',
      ]),
    )
  })

  test('rejects chronology drift and unresolved supersession', () => {
    const content = `# LEARNINGS\n\n${LEARNINGS_INSERTION_MARKER}\n\n## Lesson: New\n\n- **Date:** 2026-08-10\n- **Failure:** Failure\n- **Evidence:** scripts/example.ts → symbol:example\n- **Invariant:** Invariant\n- **Guard:** Guard\n- **Verification:** Verification\n- **Scope:** internal\n- **Owning FID:** FID-2026-0811-024\n- **Status:** superseded\n- **Superseded by:** Missing replacement\n\n## Lesson: Older\n\n- **Date:** 2026-08-11\n- **Failure:** Failure\n- **Evidence:** scripts/example.ts → symbol:example\n- **Invariant:** Invariant\n- **Guard:** Guard\n- **Verification:** Verification\n- **Scope:** internal\n- **Owning FID:** FID-2026-0811-024\n- **Status:** active\n\n${LEGACY_BOUNDARY}\n`
    const result = validateLearnings(content, fixtureRoot())
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'learning.chronology.order',
        'learning.supersession.invalid-target',
      ]),
    )
  })

  test('supports multiline field values', () => {
    const content = validLearning().replace(
      '- **Failure:** Failure',
      '- **Failure:** First line\n  second line',
    )
    const result = validateLearnings(content, fixtureRoot())
    expect(result.issues).toEqual([])
    expect(result.entries[0]?.failure).toContain('second line')
  })

  test('rejects unindented prose inside a structured lesson', () => {
    const content = validLearning().replace(
      '- **Failure:** Failure',
      '- **Failure:** Failure\nunsupported prose',
    )
    const result = validateLearnings(content, fixtureRoot())
    expect(result.issues.map((issue) => issue.code)).toContain(
      'learning.structure.malformed-prose',
    )
  })

  test('rejects out-of-range line snapshots', () => {
    const content = validLearning().replace(
      'scripts/example.ts → symbol:example',
      'scripts/example.ts → symbol:example@line=99',
    )
    const result = validateLearnings(content, fixtureRoot())
    expect(result.issues.map((issue) => issue.code)).toContain(
      'learning.evidence.line.invalid',
    )
  })

  test('rejects unknown and duplicate fields', () => {
    const content = validLearning().replace(
      '- **Failure:** Failure',
      '- **Failure:** Failure\n- **Failure:** Duplicate\n- **Unexpected:** Unknown',
    )
    const result = validateLearnings(content, fixtureRoot())
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'learning.field.duplicate',
        'learning.field.unknown',
      ]),
    )
  })

  test('resolves command, test, and field references without prose false positives', () => {
    const root = fixtureRoot()
    fs.writeFileSync(
      path.join(root, 'scripts', 'targets.ts'),
      [
        'export const scripts = {',
        '  check: "echo once",',
        '}',
        'test.each(["case"]) ("parameterized test", () => {})',
        'const config = { targetField: true }',
        'const prose = "check: not a declaration targetField: false"',
        'const pattern = /check: ignored targetField: ignored\\/\\//;',
        'const template = `test("ignored test") ${targetField}`',
        '/* check: ignored targetField: ignored */',
        '// check target test targetField',
      ].join('\n'),
    )
    const content = validLearning().replace(
      'scripts/example.ts → symbol:example',
      'scripts/targets.ts → command:check, scripts/targets.ts → test:parameterized test, scripts/targets.ts → field:targetField',
    )
    const result = validateLearnings(content, root)
    expect(result.issues).toEqual([])
  })

  test('fails closed for unsupported tagged-template and interpolated test.each syntax', () => {
    const root = fixtureRoot()
    fs.writeFileSync(
      path.join(root, 'scripts', 'tagged.ts'),
      [
        'test.each`case`("tagged test", () => {})',
        'test.each(["case"])(`interpolated ${nested}`, () => {})',
      ].join('\\n'),
    )
    const content = validLearning().replace(
      'scripts/example.ts → symbol:example',
      'scripts/tagged.ts → test:tagged test, scripts/tagged.ts → test:interpolated ${nested}',
    )
    const result = validateLearnings(content, root)
    expect(result.issues.map((issue) => issue.code)).toContain(
      'learning.evidence.unresolved',
    )
  })

  test('fails closed when declaration-shaped command or field targets are ambiguous', () => {
    const root = fixtureRoot()
    fs.writeFileSync(
      path.join(root, 'scripts', 'ambiguous.ts'),
      [
        'const first = { check: "one", targetField: true }',
        'const second = { check: "two", targetField: false }',
      ].join('\n'),
    )
    const content = validLearning().replace(
      'scripts/example.ts → symbol:example',
      'scripts/ambiguous.ts → command:check, scripts/ambiguous.ts → field:targetField',
    )
    const result = validateLearnings(content, root)
    expect(
      result.issues.filter(
        (issue) => issue.code === 'learning.evidence.unresolved',
      ),
    ).toHaveLength(2)
  })

  test('rejects an insertion marker placed below the legacy boundary', () => {
    // FID-2026-0916-007: the marker at EOF inverted the file — every new entry
    // landed below the boundary and escaped validation entirely.
    const content = `# LEARNINGS\n\n## Lesson: Current\n\n- **Date:** 2026-08-11\n- **Failure:** Failure\n- **Evidence:** scripts/example.ts → symbol:example\n- **Invariant:** Invariant\n- **Guard:** Guard\n- **Verification:** Verification\n- **Scope:** internal\n- **Owning FID:** FID-2026-0811-024\n- **Status:** active\n- **Canonical rule:** safe-rule\n\n${LEGACY_BOUNDARY}\n\n${LEARNINGS_INSERTION_MARKER}\n`
    const result = validateLearnings(content, fixtureRoot())
    expect(result.issues.map((issue) => issue.code)).toContain(
      'learning.insertion-marker.below-boundary',
    )
  })

  test('rejects narrative prose left trailing after the legacy boundary', () => {
    const content = validLearning() + '\n## Session 2026-08-10: stray prose\n'
    const result = validateLearnings(content, fixtureRoot())
    expect(result.issues.map((issue) => issue.code)).toContain(
      'learning.legacy-boundary.trailing-content',
    )
  })

  test('rejects private or protocol-variant content in embedded source', () => {
    const issues = validateEmbeddedLearningSource(
      'docs/embedded-learnings.md',
      'email@example.com and single-agent\n',
    )
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'learning.embedded.privacy',
        'learning.embedded.protocol-boundary',
      ]),
    )
  })
})

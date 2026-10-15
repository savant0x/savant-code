import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  EMBEDDED_LEARNINGS_PATH,
  collectEmbeddedProjectionIssues,
  renderEmbeddedLearningProjection,
  writeEmbeddedLearningProjection,
} from '../learnings-projection.js'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function rule(
  name: string,
  tier: string,
  reason = 'Fixture guidance.',
): string {
  return [
    `## Rule: ${name}`,
    '',
    '- **Authority:** scripts/example.ts',
    '- **Validation:** bun test scripts/example.test.ts',
    `- **Tier:** ${tier}`,
    `- **Tier reason:** ${reason}`,
    '',
  ].join('\n')
}

function fixtureRoot(catalog: string): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'learnings-projection-'))
  temporaryRoots.push(root)
  mkdirSync(path.join(root, 'dev'), { recursive: true })
  writeFileSync(path.join(root, 'dev', 'LEARNING-RULES.md'), catalog)
  return root
}

function catalog(...rules: string[]): string {
  return `# Rules\n\n${rules.join('\n')}`
}

function destination(root: string): string {
  return path.join(root, EMBEDDED_LEARNINGS_PATH)
}

describe('embedded learning projection', () => {
  test('renders only boot rules and preserves metadata', () => {
    const root = fixtureRoot(
      catalog(
        rule('boot-rule', 'boot', 'Boot guidance.'),
        rule('reference-rule', 'reference', 'Reference guidance.'),
        rule('historical-rule', 'historical', 'Historical guidance.'),
      ),
    )

    const projection = renderEmbeddedLearningProjection(root)

    expect(projection.issues).toEqual([])
    expect(projection.content).toContain('## Rule: boot-rule')
    expect(projection.content).toContain('- **Tier reason:** Boot guidance.')
    expect(projection.content).not.toContain('reference-rule')
    expect(projection.content).not.toContain('historical-rule')
  })

  test('writes deterministically and skips the identical second generation', () => {
    const root = fixtureRoot(catalog(rule('boot-rule', 'boot')))

    const first = writeEmbeddedLearningProjection(root)
    const firstBytes = readFileSync(destination(root), 'utf8')
    const second = writeEmbeddedLearningProjection(root)

    expect(first.issues).toEqual([])
    expect(first.wrote).toBe(true)
    expect(second.issues).toEqual([])
    expect(second.wrote).toBe(false)
    expect(renderEmbeddedLearningProjection(root).content).toBe(firstBytes)
    expect(readFileSync(destination(root), 'utf8')).toBe(firstBytes)
  })

  test('reports drift after a manual destination edit with the write command', () => {
    const root = fixtureRoot(catalog(rule('boot-rule', 'boot')))
    writeEmbeddedLearningProjection(root)
    writeFileSync(
      destination(root),
      `${readFileSync(destination(root), 'utf8')}edit\n`,
    )

    const issues = collectEmbeddedProjectionIssues(root)
    const drift = issues.find(
      (issue) => issue.code === 'learning.projection.drift',
    )

    expect(drift?.message).toContain(
      'bun scripts/learnings-projection-check.ts --write',
    )
  })

  test('refuses invalid catalog or private generated content without replacing bytes', () => {
    const root = fixtureRoot(catalog(rule('boot-rule', 'boot')))
    writeEmbeddedLearningProjection(root)
    const original = readFileSync(destination(root), 'utf8')
    writeFileSync(
      path.join(root, 'dev', 'LEARNING-RULES.md'),
      catalog(
        rule('boot-rule', 'boot', 'contact email@example.com'),
        rule('invalid-rule', 'unknown'),
      ),
    )

    const result = writeEmbeddedLearningProjection(root)

    expect(result.wrote).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'learning.embedded.privacy',
        'learning.rules.tier.invalid',
      ]),
    )
    expect(readFileSync(destination(root), 'utf8')).toBe(original)
  })

  test('fails closed for an empty boot tier and a missing destination', () => {
    const root = fixtureRoot(catalog(rule('reference-rule', 'reference')))

    const issues = collectEmbeddedProjectionIssues(root)
    const result = writeEmbeddedLearningProjection(root)

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'learning.projection.empty',
        'learning.projection.missing',
      ]),
    )
    expect(result.issues.map((issue) => issue.code)).toContain(
      'learning.projection.empty',
    )
    expect(result.wrote).toBe(false)
    expect(existsSync(destination(root))).toBe(false)
  })
})

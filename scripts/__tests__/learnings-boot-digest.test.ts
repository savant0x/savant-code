import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { BOOT_LEARNINGS_MAX_CHARACTERS } from '@savant-code/common/constants/learnings-boot'

import { wrapLearningMarkdown } from '../learnings-markdown'
import {
  renderEmbeddedLearningProjection,
  writeEmbeddedLearningProjection,
  EMBEDDED_LEARNINGS_PATH,
} from '../learnings-projection'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

describe('bounded learning boot digest', () => {
  test('an unbreakable indented token cannot repeat the same wrapping state', () => {
    const token = 'x'.repeat(24_000)
    expect(wrapLearningMarkdown([`  ${token}`])).toBe(`  ${token}\n`)
  })
  test('the real digest fits the named budget and is deterministic without incident prose', () => {
    const root = path.resolve(import.meta.dir, '../..')
    const projection = renderEmbeddedLearningProjection(root)
    expect(BOOT_LEARNINGS_MAX_CHARACTERS).toBe(24_000)
    expect(projection.issues).toEqual([])
    expect(projection.content.length).toBeLessThanOrEqual(
      BOOT_LEARNINGS_MAX_CHARACTERS,
    )
    expect(projection.content).toBe(
      renderEmbeddedLearningProjection(root).content,
    )
    expect(projection.content).not.toContain('- **Failure:**')
    expect(projection.content).toContain('- **Invariant:** Generated content')
    expect(projection.content).toContain(
      '- **Guard:** `bun run learnings:check`',
    )
    expect(projection.content).toBe(
      fs.readFileSync(path.join(root, EMBEDDED_LEARNINGS_PATH), 'utf8'),
    )
  })
  test('overflow refuses generation and preserves the prior destination without dropping rules', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boot-budget-'))
    roots.push(root)
    fs.mkdirSync(path.join(root, 'dev'))
    fs.mkdirSync(path.join(root, 'docs'))
    fs.writeFileSync(
      path.join(root, EMBEDDED_LEARNINGS_PATH),
      'previous digest',
    )
    fs.writeFileSync(
      path.join(root, 'dev', 'LEARNING-RULES.md'),
      '## Rule: large-rule\n- **Authority:** fixture.ts\n- **Validation:** fixture test\n- **Tier:** boot\n- **Tier reason:** ' +
        'x'.repeat(BOOT_LEARNINGS_MAX_CHARACTERS),
    )
    const result = writeEmbeddedLearningProjection(root)
    expect(result.issues.map((issue) => issue.code)).toContain(
      'learning.boot.budget',
    )
    expect(result.wrote).toBe(false)
    expect(result.content).toContain('large-rule')
    expect(
      fs.readFileSync(path.join(root, EMBEDDED_LEARNINGS_PATH), 'utf8'),
    ).toBe('previous digest')
  })
})

/**
 * scope-targets — the ONE parser for the register's machine-readable section
 * (FID-2026-1012-027).
 *
 * Two consumers read this section now: the Law 2 write gate (target matched
 * against every item's globs) and the surface-coverage audit (a record's
 * declared gates judged against its OWN item's globs). A second parser would
 * be free to disagree with the write gate about what an item covers, so these
 * pins hold the shared grammar and the two shapes both consumers depend on.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'bun:test'

import { loadScopeArtifact, loadScopeTargetsByItem } from '../scope-targets'

const tempFiles: string[] = []
afterEach(() => {
  for (const file of tempFiles.splice(0)) {
    rmSync(path.dirname(file), { recursive: true, force: true })
  }
})

function register(content: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'savant-scope-targets-'))
  const file = path.join(dir, 'SCOPE.md')
  writeFileSync(file, content)
  tempFiles.push(file)
  return file
}

const DOC = `# SCOPE

Operator intent prose naming a stray \`not/a/target.ts\` here.

## Machine-readable scope targets

- FID-2026-1013-001: \`scripts/one.ts\`, \`scripts/two.ts\`
  \`scripts/three.ts\`
- FID-2026-1013-002: \`dev/notes.md\`

## Open items

- FID-2026-1013-003: \`outside/the/section.ts\`
`

describe('loadScopeTargetsByItem', () => {
  it('maps each item id to its own globs, head line plus continuations', () => {
    const { targets, exists, sectionPresent } = loadScopeTargetsByItem(
      register(DOC),
    )
    expect(exists).toBe(true)
    expect(sectionPresent).toBe(true)
    expect(targets.get('FID-2026-1013-001')).toEqual([
      'scripts/one.ts',
      'scripts/two.ts',
      'scripts/three.ts',
    ])
    expect(targets.get('FID-2026-1013-002')).toEqual(['dev/notes.md'])
  })

  it('stops a continuation at the next item or a blank line', () => {
    const { targets } = loadScopeTargetsByItem(
      register(
        '## Machine-readable scope targets\n\n' +
          '- A: `one.ts`\n\n' +
          '- B: `two.ts`\n',
      ),
    )
    expect(targets.get('A')).toEqual(['one.ts'])
    expect(targets.get('B')).toEqual(['two.ts'])
  })

  it('is line-oriented: an item line anywhere in the register parses', () => {
    // The grammar has always been line-oriented (the write gate matched it the
    // same way), so a `- <id>: `<glob>`` line under any heading is an item.
    // `sectionPresent` reports where the section is; it does not fence the
    // parser, and changing that would change the write gate's authority.
    const { targets } = loadScopeTargetsByItem(register(DOC))
    expect(targets.get('FID-2026-1013-003')).toEqual(['outside/the/section.ts'])
  })

  it('ignores prose that merely mentions a backticked path', () => {
    // Only a line shaped `- <id>: ...` opens an item, so the operator's
    // sentence naming `not/a/target.ts` grants no target to anything.
    const { targets } = loadScopeTargetsByItem(register(DOC))
    for (const globs of targets.values()) {
      expect(globs).not.toContain('not/a/target.ts')
    }
  })

  it('reports a missing register without inventing one', () => {
    const { targets, exists, sectionPresent } = loadScopeTargetsByItem(
      path.join(os.tmpdir(), 'savant-scope-targets-absent', 'SCOPE.md'),
    )
    expect(exists).toBe(false)
    expect(sectionPresent).toBe(false)
    expect([...targets]).toEqual([])
  })

  it('distinguishes "register exists, no section" from "section present"', () => {
    const { exists, sectionPresent, targets } = loadScopeTargetsByItem(
      register('# SCOPE\n\n## Open items\n\n- FID-2026-1013-001: `a.ts`\n'),
    )
    expect(exists).toBe(true)
    expect(sectionPresent).toBe(false)
    // Items outside the section are not register targets.
    expect(targets.get('FID-2026-1013-001')).toEqual(['a.ts'])
  })
})

describe('loadScopeArtifact', () => {
  it('flattens every item glob in file order', () => {
    const { patterns } = loadScopeArtifact(register(DOC))
    expect(patterns).toEqual([
      'scripts/one.ts',
      'scripts/two.ts',
      'scripts/three.ts',
      'dev/notes.md',
      'outside/the/section.ts',
    ])
  })

  it('carries the section-presence flag the write gate relies on', () => {
    const absentSection = loadScopeArtifact(
      register('# SCOPE\n\n## Open items\n'),
    )
    expect(absentSection.sectionPresent).toBe(false)
    const missing = loadScopeArtifact(
      path.join(os.tmpdir(), 'savant-scope-targets-absent', 'SCOPE.md'),
    )
    expect(missing).toEqual({
      patterns: [],
      exists: false,
      sectionPresent: false,
    })
  })
})

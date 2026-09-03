import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'bun:test'

import { collectHygieneIssues } from './hygiene'

const tempRoots: string[] = []

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('current hygiene scan', () => {
  it('passes the checked-in current source scope', () => {
    expect(collectHygieneIssues()).toEqual([])
  })

  it('rejects an actionable marker in a fixture source file', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'savant-hygiene-'))
    tempRoots.push(root)
    mkdirSync(path.join(root, 'agents'), { recursive: true })
    writeFileSync(
      path.join(root, 'agents', 'unfinished.ts'),
      '// TODO: implement\n',
    )

    expect(collectHygieneIssues(root)).toEqual([
      expect.objectContaining({
        code: 'production-placeholder',
        file: 'agents/unfinished.ts',
      }),
    ])
  })

  it('does not exempt an actionable marker merely because a file has tool vocabulary', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'savant-hygiene-'))
    tempRoots.push(root)
    mkdirSync(path.join(root, 'cli/src/components/tools'), { recursive: true })
    writeFileSync(
      path.join(root, 'cli/src/components/tools/write-todos.tsx'),
      'TODOs\n// TODO: implement\n',
    )

    const issues = collectHygieneIssues(root)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.file).toBe('cli/src/components/tools/write-todos.tsx')
  })
})

describe('scratchpad root hygiene (P36)', () => {
  it('passes when the scratchpad root holds only README + active/ + archive/', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'savant-hygiene-'))
    tempRoots.push(root)
    mkdirSync(path.join(root, 'dev/scratchpad/active'), { recursive: true })
    mkdirSync(path.join(root, 'dev/scratchpad/archive'), { recursive: true })
    writeFileSync(path.join(root, 'dev/scratchpad/README.md'), '# Scratchpad\n')
    writeFileSync(path.join(root, 'dev/scratchpad/.gitkeep'), '')

    expect(collectHygieneIssues(root)).toEqual([])
  })

  it('flags loose root files and ad-hoc folders as scratchpad-clutter', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'savant-hygiene-'))
    tempRoots.push(root)
    mkdirSync(path.join(root, 'dev/scratchpad'), { recursive: true })
    writeFileSync(
      path.join(root, 'dev/scratchpad/p42-some-probe.cjs'),
      '// probe\n',
    )
    mkdirSync(path.join(root, 'dev/scratchpad/some-smoke'), {
      recursive: true,
    })

    const issues = collectHygieneIssues(root).filter(
      (issue) => issue.code === 'scratchpad-clutter',
    )
    expect(issues.map((issue) => issue.file).sort()).toEqual([
      'dev/scratchpad/p42-some-probe.cjs',
      'dev/scratchpad/some-smoke',
    ])
  })

  it('ignores the check entirely when no scratchpad exists', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'savant-hygiene-'))
    tempRoots.push(root)
    expect(
      collectHygieneIssues(root).filter(
        (issue) => issue.code === 'scratchpad-clutter',
      ),
    ).toEqual([])
  })
})

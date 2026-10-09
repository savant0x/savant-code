/**
 * Release-preflight G2 pins (FID-2026-1007-014): closed FIDs carry recorded
 * commit hashes. Split from the combined G2/G5 suite under the 300-line file
 * cap; G5 lives in public-release-preflight-g5.test.ts.
 *
 * RED-first: no G2 check existed in the pre-audit family. Every pin runs a
 * fixture archive through the check with an injected git runner, so no live
 * git state is needed.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'bun:test'

import { checkG2CommitHashes } from '../public-release/pre-audit-g2-g5'

import type { GitRun } from '../public-release/pre-audit-g2-g5'

const tempRoots: string[] = []
afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function tempRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'savant-preflight-'))
  tempRoots.push(root)
  return root
}

function fidRecord(parts: {
  status?: string
  closedDate?: string
  commitState?: string | null
}): string {
  const status = `**Status:** ${parts.status ?? 'closed'}\n`
  const closed =
    parts.closedDate === undefined
      ? ''
      : `- **Closed Date:** ${parts.closedDate}\n`
  const commit =
    parts.commitState === null
      ? ''
      : `- **Commit/State:** ${parts.commitState ?? 'abc1234'}\n`
  return `# FID: test\n\n**Filename:** x\n${status}${closed}${commit}\n`
}

function archiveWith(root: string, files: Record<string, string>): void {
  const dir = path.join(root, 'dev', 'fids', 'archive')
  mkdirSync(dir, { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), content)
  }
}

function seedBaseline(root: string, entries: string[]): void {
  writeFileSync(
    path.join(root, 'dev', 'preaudit-g2-commit-baseline.json'),
    JSON.stringify(entries),
  )
}

function tagRun(tagDate: string): GitRun {
  return (_root: string, args: string[]) => {
    if (args[0] === 'tag') return { status: 0, stdout: 'v0.0.35\n', stderr: '' }
    if (args[0] === 'log')
      return { status: 0, stdout: `${tagDate}\n`, stderr: '' }
    throw new Error(`unexpected git call: ${args.join(' ')}`)
  }
}

const gitFail: GitRun = () => ({ status: 128, stdout: '', stderr: 'boom' })

describe('checkG2CommitHashes', () => {
  it('blocks a closed in-window FID with an empty Commit/State field', () => {
    const root = tempRoot()
    archiveWith(root, {
      'FID-2026-1008-001-x.md': fidRecord({
        closedDate: '2026-10-08',
        commitState: null,
      }),
    })
    const result = checkG2CommitHashes(root, tagRun('2026-10-01'))
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]?.severity).toBe('block')
    expect(result.findings[0]?.message).toContain('FID-2026-1008-001-x.md')
  })

  it('passes a closed in-window FID with a populated field', () => {
    const root = tempRoot()
    archiveWith(root, {
      'FID-2026-1008-001-x.md': fidRecord({
        closedDate: '2026-10-08',
        commitState: 'abc1234',
      }),
    })
    expect(checkG2CommitHashes(root, tagRun('2026-10-01')).findings).toEqual(
      [],
    )
  })

  it('skips a closed FID predating the release tag even with an empty field', () => {
    const root = tempRoot()
    archiveWith(root, {
      'FID-2026-0804-001-x.md': fidRecord({
        closedDate: '2026-08-06',
        commitState: null,
      }),
    })
    expect(checkG2CommitHashes(root, tagRun('2026-10-01')).findings).toEqual(
      [],
    )
  })

  it('treats a missing Closed Date as in-window (safe direction)', () => {
    const root = tempRoot()
    archiveWith(root, {
      'FID-2026-1008-001-x.md': fidRecord({ commitState: null }),
    })
    const result = checkG2CommitHashes(root, tagRun('2026-10-01'))
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]?.message).toContain('no parseable Closed Date')
  })

  it('skips a dateless record whose filename predates the tag (pre-template history)', () => {
    const root = tempRoot()
    archiveWith(root, {
      'FID-2026-0803-002-x.md': fidRecord({ commitState: null }),
    })
    expect(checkG2CommitHashes(root, tagRun('2026-10-01')).findings).toEqual(
      [],
    )
  })

  it('checks a dateless record whose filename postdates the tag', () => {
    const root = tempRoot()
    archiveWith(root, {
      'FID-2026-1008-099-x.md': fidRecord({ commitState: null }),
    })
    expect(
      checkG2CommitHashes(root, tagRun('2026-10-01')).findings,
    ).toHaveLength(1)
  })

  it('skips non-closed records', () => {
    const root = tempRoot()
    archiveWith(root, {
      'FID-2026-1007-016-x.md': fidRecord({
        status: 'analyzed',
        commitState: null,
      }),
    })
    expect(checkG2CommitHashes(root, tagRun('2026-10-01')).findings).toEqual(
      [],
    )
  })

  it('blocks the template placeholder value', () => {
    const root = tempRoot()
    archiveWith(root, {
      'FID-2026-1008-001-x.md': fidRecord({
        closedDate: '2026-10-08',
        commitState: '[Git SHA or state description]',
      }),
    })
    expect(
      checkG2CommitHashes(root, tagRun('2026-10-01')).findings,
    ).toHaveLength(1)
  })

  it('clears a record whose status line carries the closing commit', () => {
    const root = tempRoot()
    archiveWith(root, {
      'FID-2026-1003-005-x.md': fidRecord({
        status: 'closed (implemented + verified, 2026-10-03, commit 9f1b8068)',
        closedDate: '2026-10-03',
        commitState: null,
      }),
    })
    expect(checkG2CommitHashes(root, tagRun('2026-10-01')).findings).toEqual(
      [],
    )
  })

  it('blocks when release tags cannot be listed (fail-closed)', () => {
    const root = tempRoot()
    archiveWith(root, {
      'FID-2026-1008-001-x.md': fidRecord({ closedDate: '2026-10-08' }),
    })
    const result = checkG2CommitHashes(root, gitFail)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]?.severity).toBe('block')
  })

  it('grandfathers baselined pre-gate gaps', () => {
    const root = tempRoot()
    archiveWith(root, {
      'FID-2026-1008-001-x.md': fidRecord({ commitState: null }),
      'FID-2026-1008-002-x.md': fidRecord({ commitState: null }),
    })
    seedBaseline(root, ['FID-2026-1008-001-x.md', 'FID-2026-1008-002-x.md'])
    expect(checkG2CommitHashes(root, tagRun('2026-10-01')).findings).toEqual(
      [],
    )
  })

  it('blocks new gaps alongside a baseline', () => {
    const root = tempRoot()
    archiveWith(root, {
      'FID-2026-1008-001-x.md': fidRecord({ commitState: null }),
      'FID-2026-1008-002-x.md': fidRecord({ commitState: null }),
    })
    seedBaseline(root, ['FID-2026-1008-001-x.md'])
    const result = checkG2CommitHashes(root, tagRun('2026-10-01'))
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]?.message).toContain('FID-2026-1008-002-x.md')
  })

  it('fails a stale baseline entry (gap since closed)', () => {
    const root = tempRoot()
    archiveWith(root, {
      'FID-2026-1008-001-x.md': fidRecord({ commitState: 'abc1234' }),
    })
    seedBaseline(root, ['FID-2026-1008-001-x.md'])
    const result = checkG2CommitHashes(root, tagRun('2026-10-01'))
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]?.message).toContain('stale')
  })

  it('blocks a malformed baseline file (fail-closed on the gate itself)', () => {
    const root = tempRoot()
    archiveWith(root, {
      'FID-2026-1008-001-x.md': fidRecord({ commitState: 'abc1234' }),
    })
    writeFileSync(
      path.join(root, 'dev', 'preaudit-g2-commit-baseline.json'),
      'not json',
    )
    const result = checkG2CommitHashes(root, tagRun('2026-10-01'))
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]?.message).toContain('malformed')
  })
})

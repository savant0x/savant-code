/**
 * Archived-FID closure guard tests (FID-2026-0928-013).
 *
 * Drives validateArchivedFidClosures with a temp dev/fids/archive tree.
 * RED-first: this suite failed against the unmodified tree (the validator
 * did not exist and nothing walked the archive).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'bun:test'

import { validateArchivedFidClosures } from '../fid-gates'

const tempRoots: string[] = []
afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function createArchive(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'savant-fid-arch-'))
  tempRoots.push(root)
  mkdirSync(path.join(root, 'dev', 'fids', 'archive'), { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(root, 'dev', 'fids', 'archive', name), content)
  }
  return root
}

function record(status: string | null, extra = ''): string {
  const statusLine = status === null ? '' : `**Status:** ${status}\n`
  return `# FID: test\n\n**Filename:** x\n${statusLine}${extra}\n`
}

const DECLINE = '- **Archived-Declined:** operator-approved 2026-09-19'

describe('validateArchivedFidClosures', () => {
  it('accepts closed and decorated-closed records', () => {
    const root = createArchive({
      'FID-2026-0920-001-a.md': record('closed'),
      'FID-2026-0921-002-b.md': record('closed (2026-08-09 — batch closure)'),
    })
    expect(validateArchivedFidClosures(root)).toEqual([])
  })

  it('fails a post-cutoff archived record that is not closed', () => {
    const name = 'FID-2026-0917-006-stale.md'
    const root = createArchive({ [name]: record('fixed') })
    const issues = validateArchivedFidClosures(root)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.code).toBe('fid.archive.not-closed')
    expect(issues[0]?.severity).toBeUndefined()
    expect(issues[0]?.message).toContain(name)
    expect(issues[0]?.message).toContain('fixed')
  })

  it('exempts pre-cutoff records (history belongs to the T97 ruling)', () => {
    const root = createArchive({
      'FID-2026-0914-001-old.md': record('fixed'),
      'FID-2026-0831-001-older.md': record('implemented'),
    })
    expect(validateArchivedFidClosures(root)).toEqual([])
  })

  it('treats 20260915 as the first governed day', () => {
    const root = createArchive({
      'FID-2026-0915-001-edge.md': record('verified'),
    })
    const issues = validateArchivedFidClosures(root)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.code).toBe('fid.archive.not-closed')
  })

  it('accepts the dated operator-decline marker as a terminal state', () => {
    const root = createArchive({
      'FID-2026-0919-009-declined.md': record('analyzed', `${DECLINE}\n`),
    })
    expect(validateArchivedFidClosures(root)).toEqual([])
  })

  it('rejects an undated decline marker', () => {
    const root = createArchive({
      'FID-2026-0919-010-bad-marker.md': record(
        'analyzed',
        '- **Archived-Declined:** pending\n',
      ),
    })
    expect(validateArchivedFidClosures(root)).toHaveLength(1)
  })

  it('fails a post-cutoff record with no status line at all', () => {
    const root = createArchive({
      'FID-2026-0916-003-nostatus.md': record(null),
    })
    const issues = validateArchivedFidClosures(root)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toContain('no **Status:** line')
  })

  it('handles a missing or empty archive directory', () => {
    const bare = mkdtempSync(path.join(os.tmpdir(), 'savant-fid-arch-'))
    tempRoots.push(bare)
    expect(validateArchivedFidClosures(bare)).toEqual([])
    expect(validateArchivedFidClosures(createArchive({}))).toEqual([])
  })
})

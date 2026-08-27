import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'path'

import { afterEach, describe, expect, it } from 'bun:test'

import { canonicalizePath } from '../path-canonicalization'

describe('canonicalizePath (FID-2026-0823-009)', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('resolves a relative path under process.cwd() in POSIX form', () => {
    const result = canonicalizePath('dev/fids/FID-x.md')
    expect(result).not.toMatch(/^[A-Za-z]:/)
    expect(result).not.toContain('\\')
    expect(result.endsWith('/dev/fids/FID-x.md')).toBe(true)
  })

  it('normalizes a Windows absolute path (drive + backslashes) to the same form', () => {
    const relativeResult = canonicalizePath('dev/fids/FID-x.md')
    // Reconstruct the Windows-spelled absolute form from the resolved one.
    const winForm = `C:${relativeResult.replace(/\//g, '\\')}`
    expect(canonicalizePath(winForm)).toBe(relativeResult)
  })

  it('maps a tmp file reached via relative spelling and via absolute spelling to ONE form', () => {
    const dir = mkdtempSync(join(tmpdir(), 'path-canonicalization-'))
    tempDirs.push(dir)
    const file = join(dir, 'existing.ts')
    writeFileSync(file, '// x\n')
    const asRelative = relative(process.cwd(), file)
    expect(canonicalizePath(asRelative)).toBe(canonicalizePath(file))
  })

  it('is idempotent', () => {
    const once = canonicalizePath('src/a/b.ts')
    expect(canonicalizePath(once)).toBe(once)
  })
})

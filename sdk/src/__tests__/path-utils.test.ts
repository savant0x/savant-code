import { describe, expect, test } from 'bun:test'

import {
  getProjectPathLookupKeys,
  resolveFilePathWithinProject,
} from '../tools/path-utils'

// FID-014 v2 v3 + FID-2026-0718-015: Cross-platform expected-value helpers.
// After FID-015, resolveFilePath returns POSIX-normalized paths (no drive
// letter, forward-slash) on all platforms. So expected fullPath matches
// the input verbatim after stripping any leading drive letter.
// - `expectedFullPath`: POSIX-normalize the input (strip drive, forward-slash)
// - `relativePath` is already POSIX from the function
const expectedFullPath = (p: string): string =>
  p.replace(/^[A-Z]:/i, '').replace(/\\/g, '/')

describe('resolveFilePathWithinProject', () => {
  test('normalizes relative paths to full and project-relative paths', () => {
    const result = resolveFilePathWithinProject('/repo', 'src/file.ts')
    expect(result).not.toBeNull()
    expect(result!.fullPath).toBe(expectedFullPath('/repo/src/file.ts'))
    expect(result!.relativePath).toBe('src/file.ts')
  })

  test('normalizes absolute paths inside the project', () => {
    const result = resolveFilePathWithinProject(
      '/repo',
      '/repo/src/file.ts',
    )
    expect(result).not.toBeNull()
    expect(result!.fullPath).toBe(expectedFullPath('/repo/src/file.ts'))
    expect(result!.relativePath).toBe('src/file.ts')
  })

  test('allows file names that start with two dots inside the project', () => {
    const result = resolveFilePathWithinProject('/repo', '/repo/..config')
    expect(result).not.toBeNull()
    expect(result!.fullPath).toBe(expectedFullPath('/repo/..config'))
    expect(result!.relativePath).toBe('..config')
  })

  test('rejects paths outside the project', () => {
    expect(resolveFilePathWithinProject('/repo', '../outside.ts')).toBeNull()
    expect(resolveFilePathWithinProject('/repo', '/outside.ts')).toBeNull()
    expect(
      resolveFilePathWithinProject('/repo', '/repo-sibling/file.ts'),
    ).toBeNull()
  })
})

describe('getProjectPathLookupKeys', () => {
  test('returns the normalized relative key before the original absolute key', () => {
    const result = getProjectPathLookupKeys('/repo', '/repo/src/file.ts')
    // Both keys are now POSIX-normalized (no backslashes on Windows).
    expect(result).toEqual(['src/file.ts', '/repo/src/file.ts'])
  })

  test('dedupes relative paths that are already normalized', () => {
    expect(getProjectPathLookupKeys('/repo', 'src/file.ts')).toEqual([
      'src/file.ts',
    ])
  })

  test('returns only the original key for paths outside the project', () => {
    expect(getProjectPathLookupKeys('/repo', '/outside.ts')).toEqual([
      '/outside.ts',
    ])
  })
})

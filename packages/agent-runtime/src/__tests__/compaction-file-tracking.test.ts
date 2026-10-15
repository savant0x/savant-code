import { describe, expect, test } from 'bun:test'

import {
  capFileTracking,
  emptyFileTracking,
  foldFileTracking,
  mergeFileTracking,
  normalizeTrackedPath,
  unionNewestFirstTracked,
} from '../context-compactor/file-tracking'
import { MAX_CUMULATIVE_TRACKED_PATHS } from '../context-compactor/state'

describe('file-tracking: mergeFileTracking (FID-2026-1006-002 WP5)', () => {
  test('first compaction: null previous yields the normalized current window', () => {
    const merged = mergeFileTracking(null, {
      readFiles: ['src\\a.ts'],
      modifiedFiles: [],
      createdFiles: ['src\\new.ts'],
    })
    expect(merged).toEqual({
      readFiles: ['src/a.ts'],
      modifiedFiles: [],
      createdFiles: ['src/new.ts'],
    })
  })

  test('successive compactions merge newest-first with dedup', () => {
    const merged = mergeFileTracking(
      { readFiles: ['a.ts', 'b.ts'], modifiedFiles: [], createdFiles: [] },
      {
        readFiles: ['b.ts', 'c.ts'],
        modifiedFiles: ['a.ts'],
        createdFiles: [],
      },
    )
    expect(merged.readFiles).toEqual(['b.ts', 'c.ts', 'a.ts'])
    expect(merged.modifiedFiles).toEqual(['a.ts'])
    expect(merged.createdFiles).toEqual([])
  })

  test('cumulative ledger: a path from an old window survives later folds', () => {
    const w1 = { readFiles: ['old.ts'], modifiedFiles: [], createdFiles: [] }
    const w2 = { readFiles: ['mid.ts'], modifiedFiles: [], createdFiles: [] }
    const w3 = { readFiles: ['new.ts'], modifiedFiles: [], createdFiles: [] }
    const ledger = foldFileTracking([w1, w2, w3])
    expect(ledger.readFiles).toEqual(['new.ts', 'mid.ts', 'old.ts'])
  })
})

describe('file-tracking: foldFileTracking', () => {
  test('empty fold yields empty tracking', () => {
    expect(foldFileTracking([])).toEqual(emptyFileTracking())
  })

  test('normalizes repo-relative paths when projectRoot is given', () => {
    const ledger = foldFileTracking(
      [
        {
          readFiles: ['C:\\repo\\src\\one.ts'],
          modifiedFiles: [],
          createdFiles: [],
        },
        {
          readFiles: ['C:\\repo\\src\\two.ts'],
          modifiedFiles: [],
          createdFiles: [],
        },
      ],
      'C:\\repo',
    )
    expect(ledger.readFiles).toEqual(['src/two.ts', 'src/one.ts'])
  })

  test('keeps lists independent (read/modified/created do not cross-pollinate)', () => {
    const ledger = foldFileTracking([
      { readFiles: ['r.ts'], modifiedFiles: ['m.ts'], createdFiles: ['c.ts'] },
    ])
    expect(ledger.readFiles).toEqual(['r.ts'])
    expect(ledger.modifiedFiles).toEqual(['m.ts'])
    expect(ledger.createdFiles).toEqual(['c.ts'])
  })
})

describe('file-tracking: capFileTracking', () => {
  test('newest-first lists keep their head when the cap applies', () => {
    const capped = capFileTracking(
      {
        readFiles: ['n1', 'n2', 'n3', 'n4', 'n5'],
        modifiedFiles: ['m1'],
        createdFiles: [],
      },
      3,
    )
    expect(capped.readFiles).toEqual(['n1', 'n2', 'n3'])
    expect(capped.modifiedFiles).toEqual(['m1'])
    expect(capped.createdFiles).toEqual([])
  })

  test('default cap is the state constant', () => {
    const many = Array.from(
      { length: MAX_CUMULATIVE_TRACKED_PATHS + 10 },
      (_, i) => `p${i}`,
    )
    const capped = capFileTracking({
      readFiles: many,
      modifiedFiles: [],
      createdFiles: [],
    })
    expect(capped.readFiles).toHaveLength(MAX_CUMULATIVE_TRACKED_PATHS)
    expect(capped.readFiles[0]).toBe('p0') // newest-first head survives
  })

  test('zero cap empties the lists without throwing', () => {
    const capped = capFileTracking(
      { readFiles: ['a'], modifiedFiles: ['b'], createdFiles: ['c'] },
      0,
    )
    expect(capped).toEqual(emptyFileTracking())
  })
})

describe('file-tracking: normalizeTrackedPath', () => {
  test('Windows separators always become forward slashes', () => {
    expect(normalizeTrackedPath('src\\util\\x.ts')).toBe('src/util/x.ts')
  })

  test('paths under projectRoot become repo-relative (case-insensitive)', () => {
    expect(normalizeTrackedPath('C:\\Repo\\src\\x.ts', 'c:\\repo')).toBe(
      'src/x.ts',
    )
    expect(normalizeTrackedPath('c:\\repo', 'c:\\repo')).toBe('.')
  })

  test('paths outside projectRoot stay (separator-normalized)', () => {
    expect(normalizeTrackedPath('D:\\elsewhere\\y.ts', 'C:\\repo')).toBe(
      'D:/elsewhere/y.ts',
    )
  })

  test('empty path passes through', () => {
    expect(normalizeTrackedPath('')).toBe('')
  })
})

describe('file-tracking: unionNewestFirstTracked', () => {
  test('current leads, previous trails, duplicates and empties drop', () => {
    expect(unionNewestFirstTracked(['b', 'c'], ['a', 'b', ''])).toEqual([
      'b',
      'c',
      'a',
    ])
  })
})

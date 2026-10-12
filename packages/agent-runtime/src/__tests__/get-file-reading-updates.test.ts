import { describe, expect, test } from 'bun:test'

import { getFileReadingUpdates } from '../get-file-reading-updates'

describe('getFileReadingUpdates', () => {
  test('returns files keyed by the requested paths', async () => {
    const files = await getFileReadingUpdates({
      requestedFiles: ['src/index.ts'],
      requestFiles: async () => ({
        'src/index.ts': 'console.log("hello")',
      }),
    })

    expect(files).toEqual([
      {
        path: 'src/index.ts',
        content: 'console.log("hello")',
      },
    ])
  })

  test('keeps files returned under normalized paths', async () => {
    const files = await getFileReadingUpdates({
      requestedFiles: ['/project/src/index.ts', './src/util.ts'],
      requestFiles: async () => ({
        'src/index.ts': 'console.log("hello")',
        'src/util.ts': 'export const util = true',
      }),
    })

    expect(files).toEqual([
      {
        path: 'src/index.ts',
        content: 'console.log("hello")',
      },
      {
        path: 'src/util.ts',
        content: 'export const util = true',
      },
    ])
  })

  // LF-001 (FID-2026-1012-007): the window must reach the fetch boundary,
  // which is the only place that still holds the complete file.
  test('forwards a requested line window to the fetch boundary', async () => {
    const seen: Array<{
      filePaths: string[]
      offset?: number
      limit?: number
    }> = []

    const files = await getFileReadingUpdates({
      requestedFiles: ['dev/LEARNINGS.md'],
      offset: 1750,
      limit: 40,
      requestFiles: async (params) => {
        seen.push(params)
        return { 'dev/LEARNINGS.md': 'real lines past the read cap' }
      },
    })

    expect(seen).toEqual([
      { filePaths: ['dev/LEARNINGS.md'], offset: 1750, limit: 40 },
    ])
    expect(files).toEqual([
      { path: 'dev/LEARNINGS.md', content: 'real lines past the read cap' },
    ])
  })

  test('omits null file results', async () => {
    const files = await getFileReadingUpdates({
      requestedFiles: ['missing.ts', 'src/index.ts'],
      requestFiles: async () => ({
        'missing.ts': null,
        'src/index.ts': 'content',
      }),
    })

    expect(files).toEqual([
      {
        path: 'src/index.ts',
        content: 'content',
      },
    ])
  })
})

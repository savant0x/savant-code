import crypto from 'node:crypto'

import { READ_FILES_MAX_CHARS } from '@savant-code/common/constants/read-files'
import { FILE_READ_STATUS } from '@savant-code/common/old-constants'
import * as projectFileTree from '@savant-code/common/project-file-tree'
import { createNodeError } from '@savant-code/common/testing/errors'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from 'bun:test'

import { readFiles } from '../run/tool-call'
import { getFiles } from '../tools/read-files'

import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'
import type { PathLike } from 'node:fs'

// LF-001 (FID-2026-1012-007): the window is served by THIS boundary, on the
// complete file, before the response is capped. Before the fix the SDK
// truncated at READ_FILES_MAX_CHARS and the runtime sliced afterwards, so any
// offset past the prefix came back empty. Harness (createMockFs, spies) copied
// verbatim from read-files-gitignore.test.ts.
function createMockFs(config: {
  files?: Record<string, { content: string; size?: number }>
  errors?: Record<string, { code?: string; message?: string }>
}): SavantCodeFileSystem {
  const { files = {}, errors = {} } = config

  return {
    readFile: async (filePath: PathLike) => {
      const pathStr = String(filePath)
      if (errors[pathStr]) {
        throw createNodeError(
          errors[pathStr].message || 'Unknown error',
          errors[pathStr].code || 'UNKNOWN',
        )
      }
      if (files[pathStr]) {
        return files[pathStr].content
      }
      throw createNodeError(
        `ENOENT: no such file or directory: ${pathStr}`,
        'ENOENT',
      )
    },
    stat: async (filePath: PathLike) => {
      const pathStr = String(filePath)
      if (errors[pathStr]) {
        throw createNodeError(
          errors[pathStr].message || 'Unknown error',
          errors[pathStr].code || 'UNKNOWN',
        )
      }
      if (files[pathStr]) {
        return {
          size: files[pathStr].size ?? files[pathStr].content.length,
          isDirectory: () => false,
          isFile: () => true,
          atimeMs: Date.now(),
          mtimeMs: Date.now(),
        }
      }
      throw createNodeError(
        `ENOENT: no such file or directory: ${pathStr}`,
        'ENOENT',
      )
    },
    readdir: async () => [],
    mkdir: async () => undefined,
    writeFile: async () => undefined,
  } as unknown as SavantCodeFileSystem
}

const digest = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex')

const LINES = Array.from(
  { length: 3000 },
  (_, index) => `line ${index + 1} ${'x'.repeat(40)}`,
)
const CONTENT = `${LINES.join('\n')}\n`

describe('getFiles line windows (LF-001)', () => {
  let isFileIgnoredSpy: ReturnType<typeof spyOn>
  let mockFs: SavantCodeFileSystem

  beforeEach(() => {
    isFileIgnoredSpy = spyOn(
      projectFileTree,
      'isFileIgnored',
    ).mockResolvedValue(false)
    mockFs = createMockFs({
      files: { '/project/big.md': { content: CONTENT, size: CONTENT.length } },
    })
  })

  afterEach(() => {
    mock.restore()
  })

  test('serves a window past the 100k cap with the real requested lines', async () => {
    // The pre-fix failure mode, stated against the same fixture: the capped
    // prefix does not reach line 2,000 at all.
    const cappedPrefix = CONTENT.slice(0, READ_FILES_MAX_CHARS)
    expect(cappedPrefix.split('\n').length).toBeLessThan(2000)

    const result = await getFiles({
      filePaths: ['big.md'],
      cwd: '/project',
      fs: mockFs,
      offset: 2000,
      limit: 2,
    })

    expect(result['big.md']).toBe(`${LINES.slice(1999, 2001).join('\n')}\n`)
  })

  test('overlapping pages reconstruct the complete file with a matching SHA-256', async () => {
    const pages: string[] = []
    for (let start = 1; start <= LINES.length; start += 401) {
      const page = await getFiles({
        filePaths: ['big.md'],
        cwd: '/project',
        fs: mockFs,
        offset: start,
        limit: 401,
      })
      pages.push(page['big.md'] as string)
    }

    expect(digest(pages.join(''))).toBe(digest(CONTENT))
  })

  test('still caps a window larger than the read limit', async () => {
    const result = await getFiles({
      filePaths: ['big.md'],
      cwd: '/project',
      fs: mockFs,
      offset: 1,
      limit: 100_000,
    })
    const value = result['big.md'] as string

    expect(value).toContain('FILE_TOO_LARGE')
    expect(value.length).toBeLessThan(READ_FILES_MAX_CHARS + 400)
  })

  test('keeps the previous truncation notice for an unwindowed read', async () => {
    const result = await getFiles({
      filePaths: ['big.md'],
      cwd: '/project',
      fs: mockFs,
    })
    const value = result['big.md'] as string

    expect(value).toContain('FILE_TOO_LARGE')
    expect(value.startsWith('line 1 ')).toBe(true)
    expect(value.length).toBeLessThan(READ_FILES_MAX_CHARS + 400)
  })

  test('applies the window to a file that fits under the limit', async () => {
    const small = createMockFs({
      files: { '/project/small.md': { content: 'a\nb\nc\n' } },
    })

    const result = await getFiles({
      filePaths: ['small.md'],
      cwd: '/project',
      fs: small,
      offset: 2,
      limit: 2,
    })

    expect(result['small.md']).toBe('b\nc\n')
  })

  test('keeps the 10MB safety rule for a windowed read', async () => {
    const oversized = createMockFs({
      files: {
        '/project/huge.bin': {
          content: 'x',
          size: 11 * 1024 * 1024,
        },
      },
    })

    const result = await getFiles({
      filePaths: ['huge.bin'],
      cwd: '/project',
      fs: oversized,
      offset: 10,
      limit: 10,
    })

    expect(result['huge.bin']).toContain(FILE_READ_STATUS.TOO_LARGE)
  })

  test('keeps ignored files ignored for a windowed read', async () => {
    isFileIgnoredSpy.mockResolvedValue(true)

    const result = await getFiles({
      filePaths: ['big.md'],
      cwd: '/project',
      fs: mockFs,
      offset: 2000,
      limit: 2,
    })

    expect(result['big.md']).toBe(FILE_READ_STATUS.IGNORED)
  })

  test('forwards the window to an override, which owns its response', async () => {
    const received: Array<{
      filePaths: string[]
      offset?: number
      limit?: number
    }> = []

    await readFiles({
      filePaths: ['big.md'],
      offset: 1750,
      limit: 5,
      cwd: '/project',
      fs: mockFs,
      override: async (input) => {
        received.push(input)
        return { 'big.md': 'override content' }
      },
    })

    expect(received).toEqual([
      { filePaths: ['big.md'], offset: 1750, limit: 5 },
    ])
  })
})

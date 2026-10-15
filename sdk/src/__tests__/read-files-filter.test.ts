import { FILE_READ_STATUS } from '@savant-code/common/old-constants'
import * as projectFileTree from '@savant-code/common/project-file-tree'
import { createNodeError } from '@savant-code/common/testing/errors'
import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  mock,
  spyOn,
} from 'bun:test'

import { getFiles } from '../tools/read-files'

import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'
import type { PathLike } from 'node:fs'

// FID-2026-0819-005 Loop 209: fileFilter-option suite moved verbatim from
// read-files.test.ts; harness (createMockFs, spies, beforeEach/afterEach)
// copied verbatim.

// Helper to create a mock filesystem
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

describe('getFiles', () => {
  let isFileIgnoredSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    // Default: no files are ignored
    isFileIgnoredSpy = spyOn(
      projectFileTree,
      'isFileIgnored',
    ).mockResolvedValue(false)
  })

  afterEach(() => {
    mock.restore()
  })

  describe('fileFilter option', () => {
    test('should block files when filter returns blocked status', async () => {
      const mockFs = createMockFs({
        files: {
          '/project/.env': { content: 'SECRET=value' },
          '/project/src/index.ts': { content: 'normal file' },
        },
      })

      const result = await getFiles({
        filePaths: ['.env', 'src/index.ts'],
        cwd: '/project',
        fs: mockFs,
        fileFilter: (path) => {
          if (path === '.env') return { status: 'blocked' }
          return { status: 'allow' }
        },
      })

      expect(result['.env']).toBe(FILE_READ_STATUS.IGNORED)
      expect(result['src/index.ts']).toBe('normal file')
    })

    test('should mark template files with TEMPLATE prefix', async () => {
      const mockFs = createMockFs({
        files: {
          '/project/.env.example': { content: 'API_KEY=your_key_here' },
        },
      })

      const result = await getFiles({
        filePaths: ['.env.example'],
        cwd: '/project',
        fs: mockFs,
        fileFilter: () => ({ status: 'allow-example' }),
      })

      expect(result['.env.example']).toBe(
        FILE_READ_STATUS.TEMPLATE + '\n' + 'API_KEY=your_key_here',
      )
    })

    test('should skip gitignore check for allow-example files', async () => {
      // When caller provides a filter that returns allow-example,
      // the file is read and marked with TEMPLATE prefix
      isFileIgnoredSpy.mockResolvedValue(true)

      const mockFs = createMockFs({
        files: {
          '/project/.env.example': { content: 'template content' },
        },
      })

      const result = await getFiles({
        filePaths: ['.env.example'],
        cwd: '/project',
        fs: mockFs,
        fileFilter: () => ({ status: 'allow-example' }),
      })

      // Should NOT be blocked since caller's filter marked it as allow-example
      expect(result['.env.example']).toBe(
        FILE_READ_STATUS.TEMPLATE + '\n' + 'template content',
      )
      // When a custom filter is provided, gitignore is not checked
      expect(isFileIgnoredSpy).not.toHaveBeenCalled()
    })

    test('should run filter before gitignore check', async () => {
      const mockFs = createMockFs({
        files: {
          '/project/secret.key': { content: 'private key' },
        },
      })

      const result = await getFiles({
        filePaths: ['secret.key'],
        cwd: '/project',
        fs: mockFs,
        fileFilter: () => ({ status: 'blocked' }),
      })

      expect(result['secret.key']).toBe(FILE_READ_STATUS.IGNORED)
      // isFileIgnored should not have been called since filter blocked first
      expect(isFileIgnoredSpy).not.toHaveBeenCalled()
    })

    test('should still enforce other checks for template files', async () => {
      const mockFs = createMockFs({
        files: {},
      })

      const result = await getFiles({
        filePaths: ['/etc/passwd', 'nonexistent.txt'],
        cwd: '/project',
        fs: mockFs,
        fileFilter: () => ({ status: 'allow-example' }),
      })

      // Missing files outside the project are reported as missing, not blocked
      expect(result['/etc/passwd']).toBe(FILE_READ_STATUS.DOES_NOT_EXIST)
      // Should still report missing files
      expect(result['nonexistent.txt']).toBe(FILE_READ_STATUS.DOES_NOT_EXIST)
    })
  })
})

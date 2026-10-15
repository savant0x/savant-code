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

  describe('reading normal files', () => {
    test('should return file content for a valid file', async () => {
      const mockFs = createMockFs({
        files: {
          '/project/src/index.ts': { content: 'console.log("hello")' },
        },
      })

      const result = await getFiles({
        filePaths: ['src/index.ts'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['src/index.ts']).toBe('console.log("hello")')
    })

    test('should handle multiple files', async () => {
      const mockFs = createMockFs({
        files: {
          '/project/src/a.ts': { content: 'file a' },
          '/project/src/b.ts': { content: 'file b' },
        },
      })

      const result = await getFiles({
        filePaths: ['src/a.ts', 'src/b.ts'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['src/a.ts']).toBe('file a')
      expect(result['src/b.ts']).toBe('file b')
    })

    test('should skip empty file paths', async () => {
      const mockFs = createMockFs({
        files: {
          '/project/src/index.ts': { content: 'content' },
        },
      })

      const result = await getFiles({
        filePaths: ['', 'src/index.ts', ''],
        cwd: '/project',
        fs: mockFs,
      })

      expect(Object.keys(result)).toEqual(['src/index.ts'])
      expect(result['src/index.ts']).toBe('content')
    })
  })

  describe('file not found', () => {
    test('should return DOES_NOT_EXIST for missing files', async () => {
      const mockFs = createMockFs({
        files: {},
      })

      const result = await getFiles({
        filePaths: ['nonexistent.ts'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['nonexistent.ts']).toBe(FILE_READ_STATUS.DOES_NOT_EXIST)
    })
  })

  describe('file outside project', () => {
    test('should read absolute paths outside project', async () => {
      const mockFs = createMockFs({
        files: {
          '/etc/hosts': { content: '127.0.0.1 localhost' },
        },
      })

      const result = await getFiles({
        filePaths: ['/etc/hosts'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['/etc/hosts']).toBe('127.0.0.1 localhost')
    })

    test('should read relative paths that escape project', async () => {
      const mockFs = createMockFs({
        files: {
          '/outside/secret.txt': { content: 'secret' },
        },
      })

      const result = await getFiles({
        filePaths: ['../outside/secret.txt'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['/outside/secret.txt']).toBe('secret')
    })

    test('should not apply project gitignore to files outside the project', async () => {
      // An out-of-project path that contains a default-ignored segment
      // (node_modules) must still be readable — gitignore is project-scoped.
      const mockFs = createMockFs({
        files: {
          '/other/node_modules/pkg/index.js': { content: 'module.exports = 1' },
        },
      })

      const result = await getFiles({
        filePaths: ['/other/node_modules/pkg/index.js'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['/other/node_modules/pkg/index.js']).toBe(
        'module.exports = 1',
      ) // The project-scoped gitignore check must be skipped entirely.
      expect(isFileIgnoredSpy).not.toHaveBeenCalled()
    })
  })

  describe('file read errors', () => {
    test('should return ERROR for unexpected read errors', async () => {
      const mockFs = createMockFs({
        files: {},
        errors: {
          '/project/broken.ts': {
            code: 'EACCES',
            message: 'Permission denied',
          },
        },
      })

      const result = await getFiles({
        filePaths: ['broken.ts'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['broken.ts']).toBe(FILE_READ_STATUS.ERROR)
    })
  })

  describe('path normalization', () => {
    test('should convert absolute paths within project to relative paths', async () => {
      const mockFs = createMockFs({
        files: {
          '/project/src/index.ts': { content: 'content' },
        },
      })

      const result = await getFiles({
        filePaths: ['/project/src/index.ts'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['src/index.ts']).toBe('content')
    })

    test('should read absolute paths in sibling directories with matching prefixes', async () => {
      const mockFs = createMockFs({
        files: {
          '/project-other/src/index.ts': { content: 'outside' },
        },
      })

      const result = await getFiles({
        filePaths: ['/project-other/src/index.ts'],
        cwd: '/project',
        fs: mockFs,
      })

      expect(result['/project-other/src/index.ts']).toBe('outside')
    })
  })
})

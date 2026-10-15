import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import {
  clearMockedModules,
  mockModule,
} from '@savant-code/common/testing/mock-modules'
import {
  createMockChildProcess,
  asCodeSearchResult,
  createRgJsonMatch,
} from '@savant-code/common/testing/mocks'
import {
  describe,
  expect,
  it,
  mock,
  beforeEach,
  afterEach,
  afterAll,
} from 'bun:test'

import { codeSearch } from '../tools/code-search'

import type { MockChildProcess } from '@savant-code/common/testing/mocks'

describe('codeSearch', () => {
  let mockSpawn: ReturnType<typeof mock>
  let mockProcess: MockChildProcess

  beforeEach(async () => {
    mockProcess = createMockChildProcess()
    mockSpawn = mock(() => mockProcess)
    await mockModule('child_process', () => ({
      spawn: mockSpawn,
    }))
  })

  afterEach(() => {
    mock.restore()
    clearMockedModules()
  })

  describe('glob pattern handling', () => {
    it('should handle -g flag with glob patterns like *.ts', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'import',
        flags: '-g *.ts',
      })

      const output = [
        createRgJsonMatch('file.ts', 1, 'import foo from "bar"'),
        createRgJsonMatch('file.ts', 5, 'import { baz } from "qux"'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      expect(result[0].type).toBe('json')
      const value = asCodeSearchResult(result[0])
      expect(value.stdout).toContain('file.ts:')

      // Verify the args passed to spawn include the glob flag correctly
      expect(mockSpawn).toHaveBeenCalled()
      const spawnArgs = mockSpawn.mock.calls[0]![1] as string[]
      expect(spawnArgs).toContain('-g')
      expect(spawnArgs).toContain('*.ts')
    })

    it('should handle -g flag with multiple glob patterns', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'import',
        flags: '-g *.ts -g *.tsx',
      })

      const output = createRgJsonMatch(
        'file.tsx',
        1,
        'import React from "react"',
      )

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      expect(result[0].type).toBe('json')
      const value = asCodeSearchResult(result[0])
      expect(value.stdout).toContain('file.tsx:')

      // Verify both glob patterns are passed correctly
      const spawnArgs = mockSpawn.mock.calls[0]![1] as string[]
      // Should have two -g flags, each followed by its pattern
      const gFlagIndices = spawnArgs
        .map((arg, i) => (arg === '-g' ? i : -1))
        .filter((i) => i !== -1)
      expect(gFlagIndices.length).toBe(2)
      expect(spawnArgs[gFlagIndices[0]! + 1]).toBe('*.ts')
      expect(spawnArgs[gFlagIndices[1]! + 1]).toBe('*.tsx')
    })

    it('should strip single quotes from glob pattern arguments (regression: spawn has no shell)', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'auth',
        flags: "-g 'authentication.knowledge.md'",
      })

      const output = createRgJsonMatch(
        'authentication.knowledge.md',
        5,
        'auth content',
      )

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])
      expect(value.stdout).toContain('authentication.knowledge.md:')

      // Verify the quotes were stripped before passing to spawn
      const spawnArgs = mockSpawn.mock.calls[0]![1] as string[]
      expect(spawnArgs).toContain('authentication.knowledge.md')
      expect(spawnArgs).not.toContain("'authentication.knowledge.md'")
    })

    it('should strip double quotes from glob pattern arguments', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'import',
        flags: '-g "*.ts"',
      })

      const output = createRgJsonMatch('file.ts', 1, 'import foo')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])
      expect(value.stdout).toContain('file.ts:')

      const spawnArgs = mockSpawn.mock.calls[0]![1] as string[]
      expect(spawnArgs).toContain('*.ts')
      expect(spawnArgs).not.toContain('"*.ts"')
    })

    it('should strip quotes from multiple glob patterns', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'import',
        flags: "-g '*.ts' -g '*.tsx'",
      })

      const output = createRgJsonMatch('file.tsx', 1, 'import React')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      await searchPromise

      const spawnArgs = mockSpawn.mock.calls[0]![1] as string[]
      expect(spawnArgs).toContain('*.ts')
      expect(spawnArgs).toContain('*.tsx')
      expect(spawnArgs).not.toContain("'*.ts'")
      expect(spawnArgs).not.toContain("'*.tsx'")
    })

    it('should not deduplicate flag-argument pairs', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'import',
        flags: '-g *.ts -i -g *.tsx',
      })

      const output = createRgJsonMatch(
        'file.tsx',
        1,
        'import React from "react"',
      )

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      await searchPromise

      // Verify flags are preserved in order without deduplication
      const spawnArgs = mockSpawn.mock.calls[0]![1] as string[]
      const flagsSection = spawnArgs.slice(0, spawnArgs.indexOf('--'))
      expect(flagsSection).toContain('-g')
      expect(flagsSection).toContain('*.ts')
      expect(flagsSection).toContain('-i')
      expect(flagsSection).toContain('*.tsx')

      // Count -g flags - should be 2, not deduplicated to 1
      const gCount = flagsSection.filter((arg) => arg === '-g').length
      expect(gCount).toBe(2)
    })
  })

  describe('cwd parameter handling', () => {
    // The spawn-path contract is pinned against REAL fixture directories:
    // FID-2026-1004-006 refuses a non-directory cwd before spawn, so
    // resolution must be observed on directories that exist on disk. (The
    // earlier synthetic '/test/project' paths passed only while the spawn
    // was unguarded, and depended on machine accidents to pass at all.)
    const createdDirs: string[] = []
    const makeFixtureRoot = (name: string): string => {
      const root = mkdtempSync(join(tmpdir(), 'code-search-cwd-'))
      mkdirSync(join(root, name))
      createdDirs.push(root)
      return root
    }

    afterAll(() => {
      for (const dir of createdDirs) {
        rmSync(dir, { recursive: true, force: true })
      }
    })

    it('should handle cwd: "." correctly', async () => {
      const root = makeFixtureRoot('subdir')

      const searchPromise = codeSearch({
        projectPath: root,
        pattern: 'test',
        cwd: '.',
      })

      const output = createRgJsonMatch('file.ts', 1, 'test content')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      await searchPromise

      // Verify spawn was called with correct cwd
      expect(mockSpawn).toHaveBeenCalled()
      const spawnOptions = mockSpawn.mock.calls[0]![2] as { cwd: string }
      // When cwd is '.', it should resolve to the project root
      expect(spawnOptions.cwd).toBe(resolve(root))
    })

    it('should handle cwd: "subdir" correctly', async () => {
      const root = makeFixtureRoot('subdir')

      const searchPromise = codeSearch({
        projectPath: root,
        pattern: 'test',
        cwd: 'subdir',
      })

      const output = createRgJsonMatch('file.ts', 1, 'test content')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      await searchPromise

      // Verify spawn was called with correct cwd
      expect(mockSpawn).toHaveBeenCalled()
      const spawnOptions = mockSpawn.mock.calls[0]![2] as { cwd: string }
      expect(spawnOptions.cwd).toBe(resolve(root, 'subdir'))
    })

    it('should search cwd outside the project directory', async () => {
      const root = makeFixtureRoot('subdir')
      const outsideDir = resolve(root, '../outside')
      mkdirSync(outsideDir)
      createdDirs.push(outsideDir)

      const searchPromise = codeSearch({
        projectPath: root,
        pattern: 'test',
        cwd: '../outside',
      })

      const output = createRgJsonMatch('file.ts', 1, 'test content')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      await searchPromise

      // Verify spawn was called with the resolved outside cwd
      expect(mockSpawn).toHaveBeenCalled()
      const spawnOptions = mockSpawn.mock.calls[0]![2] as { cwd: string }
      expect(spawnOptions.cwd).toBe(resolve(root, '../outside'))
    })
  })
})

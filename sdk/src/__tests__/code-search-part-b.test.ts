import {
  clearMockedModules,
  mockModule,
} from '@savant-code/common/testing/mock-modules'
import {
  createMockChildProcess,
  asCodeSearchResult,
  createRgJsonMatch,
  createRgJsonContext,
} from '@savant-code/common/testing/mocks'
import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test'

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

  describe('edge cases with context lines', () => {
    it('should handle filenames with hyphens correctly', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'import',
        flags: '-A 1',
      })

      const output = [
        createRgJsonMatch('my-file.ts', 1, 'import foo'),
        createRgJsonMatch('other-file.ts', 5, 'import bar'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      // Files are formatted with filename on its own line followed by content
      expect(value.stdout).toContain('my-file.ts:')
      expect(value.stdout).toContain('import foo')
      expect(value.stdout).toContain('other-file.ts:')
      expect(value.stdout).toContain('import bar')
    })

    it('should handle filenames with multiple hyphens and underscores', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'test',
        flags: '-A 1',
      })

      const output = createRgJsonMatch(
        'my-complex_file-name.ts',
        10,
        'test content',
      )

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      // Should parse correctly despite multiple hyphens in filename
      expect(value.stdout).toContain('my-complex_file-name.ts:')
      expect(value.stdout).toContain('test content')
    })

    it('should not accumulate entire file content (regression test)', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'import.*env',
        flags: '-A 2',
        maxOutputStringLength: 20000,
      })

      const output = [
        createRgJsonMatch('large-file.ts', 5, 'import { env } from "config"'),
        createRgJsonMatch('other.ts', 1, 'import env'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      // Output should be reasonably sized, not including entire file
      expect(value.stdout!.length).toBeLessThan(2000)

      // Should still contain the matches
      expect(value.stdout).toContain('large-file.ts:')
      expect(value.stdout).toContain('other.ts:')
    })
  })

  describe('result limiting with context lines', () => {
    it('should respect maxResults per file with context lines', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'test',
        flags: '-A 1',
        maxResults: 2,
      })

      const output = [
        createRgJsonMatch('file.ts', 1, 'test 1'),
        createRgJsonContext('file.ts', 2, 'context 1'),
        createRgJsonMatch('file.ts', 5, 'test 2'),
        createRgJsonContext('file.ts', 6, 'context 2'),
        createRgJsonMatch('file.ts', 10, 'test 3'),
        createRgJsonContext('file.ts', 11, 'context 3'),
        createRgJsonMatch('file.ts', 15, 'test 4'),
        createRgJsonContext('file.ts', 16, 'context 4'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      // Should be limited to 2 match results per file (context lines don't count toward limit)
      // Count how many 'test' matches are in the output
      const testMatches = (value.stdout!.match(/test \d/g) || []).length
      expect(testMatches).toBeLessThanOrEqual(2)
      expect(value.stdout).toContain('Results limited')

      // Should still include context lines for the matches that are shown
      if (value.stdout!.includes('test 1')) {
        expect(value.stdout).toContain('context 1')
      }
      if (value.stdout!.includes('test 2')) {
        expect(value.stdout).toContain('context 2')
      }
    })

    it('should not report truncation when matches exactly equal maxResults', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'test',
        maxResults: 2,
      })

      const output = [
        createRgJsonMatch('file.ts', 1, 'test 1'),
        createRgJsonMatch('file.ts', 2, 'test 2'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.stdout).toContain('Found 2 matches')
      expect(value.stdout).not.toContain('Results limited')
    })

    it('should respect globalMaxResults with context lines', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'test',
        flags: '-A 1',
        globalMaxResults: 3,
      })

      const output = [
        createRgJsonMatch('file1.ts', 1, 'test 1'),
        createRgJsonContext('file1.ts', 2, 'context 1'),
        createRgJsonMatch('file1.ts', 5, 'test 2'),
        createRgJsonContext('file1.ts', 6, 'context 2'),
        createRgJsonMatch('file2.ts', 1, 'test 3'),
        createRgJsonContext('file2.ts', 2, 'context 3'),
        createRgJsonMatch('file2.ts', 5, 'test 4'),
        createRgJsonContext('file2.ts', 6, 'context 4'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      // Should be limited globally to 3 match results (context lines don't count)
      const matches = (value.stdout!.match(/test \d/g) || []).length
      expect(matches).toBeLessThanOrEqual(3)
      // Check for either 'Global limit' message or truncation indicator
      const hasLimitMessage =
        value.stdout!.includes('Global limit') ||
        value.stdout!.includes('Results limited')
      expect(hasLimitMessage).toBe(true)
    })

    it('should not count context lines toward maxResults limit', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'match',
        flags: '-A 2 -B 2',
        maxResults: 1,
      })

      const output = [
        createRgJsonContext('file.ts', 1, 'context before 1'),
        createRgJsonContext('file.ts', 2, 'context before 2'),
        createRgJsonMatch('file.ts', 3, 'match line'),
        createRgJsonContext('file.ts', 4, 'context after 1'),
        createRgJsonContext('file.ts', 5, 'context after 2'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      // Should include the match
      expect(value.stdout).toContain('match line')

      // Should include all context lines even though maxResults is 1
      expect(value.stdout).toContain('context before 1')
      expect(value.stdout).toContain('context before 2')
      expect(value.stdout).toContain('context after 1')
      expect(value.stdout).toContain('context after 2')
    })
  })

  describe('malformed output handling', () => {
    it('should skip lines without separator', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'test',
      })

      const output = [
        createRgJsonMatch('file.ts', 1, 'valid line'),
        'malformed line without proper JSON',
        createRgJsonMatch('file.ts', 2, 'another valid line'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      // Should still process valid lines
      expect(value.stdout).toContain('valid line')
      expect(value.stdout).toContain('another valid line')
    })

    it('should handle empty output', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'nonexistent',
      })

      mockProcess.stdout.emit('data', Buffer.from(''))
      mockProcess.emit('close', 1)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.stdout).toBe('Found 0 matches')
    })
  })
})

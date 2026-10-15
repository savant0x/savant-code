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

  describe('basic search', () => {
    it('should parse standard ripgrep output without context flags', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'import',
      })

      // Simulate ripgrep JSON output
      const output = [
        createRgJsonMatch('file1.ts', 1, 'import foo from "bar"'),
        createRgJsonMatch('file1.ts', 5, 'import { baz } from "qux"'),
        createRgJsonMatch('file2.ts', 10, 'import React from "react"'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      expect(result[0].type).toBe('json')
      const value = asCodeSearchResult(result[0])
      expect(value.stdout).toContain('Found 3 matches')
      expect(value.stdout).toContain('file1.ts:')
      expect(value.stdout).toContain('  Line 1: import foo from "bar"')
      expect(value.stdout).toContain('file2.ts:')
    })
  })

  describe('context flags handling', () => {
    it('should correctly parse output with -A flag (after context)', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'import.*env',
        flags: '-A 2',
      })

      // Ripgrep JSON output with -A 2 includes match + 2 context lines after
      const output = [
        createRgJsonMatch('test.ts', 1, 'import { env } from "./config"'),
        createRgJsonContext('test.ts', 2, 'const apiUrl = env.API_URL'),
        createRgJsonContext('test.ts', 3, 'const apiKey = env.API_KEY'),
        createRgJsonMatch('other.ts', 5, 'import env from "process"'),
        createRgJsonContext('other.ts', 6, 'const nodeEnv = env.NODE_ENV'),
        createRgJsonContext('other.ts', 7, 'const port = env.PORT'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      expect(result[0].type).toBe('json')
      const value = asCodeSearchResult(result[0])

      expect(value.stdout).toContain('Found 2 matches')

      // Should contain match lines
      expect(value.stdout).toContain('import { env } from "./config"')
      expect(value.stdout).toContain('import env from "process"')

      // Should contain context lines (this is the bug - they're currently missing)
      expect(value.stdout).toContain('const apiUrl = env.API_URL')
      expect(value.stdout).toContain('const apiKey = env.API_KEY')
      expect(value.stdout).toContain('const nodeEnv = env.NODE_ENV')
      expect(value.stdout).toContain('const port = env.PORT')
    })

    it('should correctly parse output with -B flag (before context)', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'export',
        flags: '-B 2',
      })

      // Ripgrep JSON output with -B 2 includes 2 context lines before + match
      const output = [
        createRgJsonContext('app.ts', 1, 'import React from "react"'),
        createRgJsonContext('app.ts', 2, ''),
        createRgJsonMatch('app.ts', 3, 'export const main = () => {}'),
        createRgJsonContext(
          'utils.ts',
          8,
          'function validateInput(x: string) {',
        ),
        createRgJsonContext('utils.ts', 9, '  return x.length > 0'),
        createRgJsonMatch('utils.ts', 10, 'export function helper() {}'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      // Should contain match lines
      expect(value.stdout).toContain('export const main = () => {}')
      expect(value.stdout).toContain('export function helper() {}')

      // Should contain before context lines
      expect(value.stdout).toContain('import React from "react"')
      expect(value.stdout).toContain('function validateInput(x: string) {')
      expect(value.stdout).toContain('return x.length > 0')
    })

    it('should correctly parse output with -C flag (context before and after)', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'TODO',
        flags: '-C 1',
      })

      // Ripgrep JSON output with -C 1 includes 1 line before + match + 1 line after
      const output = [
        createRgJsonContext('code.ts', 5, 'function processData() {'),
        createRgJsonMatch('code.ts', 6, '  // TODO: implement this'),
        createRgJsonContext('code.ts', 7, '  return null'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      // Should contain match line
      expect(value.stdout).toContain('TODO: implement this')

      // Should contain context lines before and after
      expect(value.stdout).toContain('function processData() {')
      expect(value.stdout).toContain('return null')
    })

    it('should handle -A flag with multiple matches in same file', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'import',
        flags: '-A 1',
      })

      const output = [
        createRgJsonMatch('file.ts', 1, 'import foo from "foo"'),
        createRgJsonContext('file.ts', 2, 'import bar from "bar"'),
        createRgJsonMatch('file.ts', 3, 'import baz from "baz"'),
        createRgJsonContext('file.ts', 4, ''),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      // Should contain all matches
      expect(value.stdout).toContain('import foo from "foo"')
      expect(value.stdout).toContain('import baz from "baz"')

      // Context line appears as both context and match
      expect(value.stdout).toContain('import bar from "bar"')
    })

    it('should handle -B flag at start of file', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'import',
        flags: '-B 2',
      })

      // First line match has no before context
      const output = createRgJsonMatch('file.ts', 1, 'import foo from "foo"')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      // Should still work with match at file start
      expect(value.stdout).toContain('import foo from "foo"')
    })

    it('should skip separator lines between result groups', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'test',
        flags: '-A 1',
      })

      const output = [
        createRgJsonMatch('file1.ts', 1, 'test line'),
        createRgJsonMatch('file2.ts', 5, 'another test'),
      ].join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      // Should not contain '--' separator
      expect(value.stdout).not.toContain('--')
    })
  })
})

import {
  clearMockedModules,
  mockModule,
} from '@savant-code/common/testing/mock-modules'
import {
  createMockChildProcess,
  asCodeSearchResult,
  createRgJsonMatch,
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

  describe('bug fixes validation', () => {
    it('should handle patterns starting with hyphen (regression test)', async () => {
      // Bug: Patterns starting with '-' were misparsed as flags
      // Fix: Added '--' separator before pattern in args
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: '-foo',
      })

      const output = createRgJsonMatch('file.ts', 1, 'const x = -foo')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.stdout).toContain('file.ts:')
      expect(value.stdout).toContain('-foo')
    })

    it('should strip trailing newlines from line text (regression test)', async () => {
      // Bug: JSON lineText includes trailing \n, causing blank lines
      // Fix: Strip \r?\n from lineText
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'import',
      })

      // Simulate ripgrep JSON with trailing newlines in lineText
      const output = JSON.stringify({
        type: 'match',
        data: {
          path: { text: 'file.ts' },
          lines: { text: 'import foo from "bar"\n' }, // trailing newline
          line_number: 1,
        },
      })

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      // Should not have double newlines or blank lines
      expect(value.stdout).not.toContain('\n\n\n')
      expect(value.stdout).toContain('import foo')
    })

    it('should process multiple JSON objects in remainder at close (regression test)', async () => {
      // Bug: Only processed one JSON object in remainder
      // Fix: Loop through all complete lines in remainder
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'test',
      })

      // Send partial JSON chunks that will be completed in remainder
      const match1 = createRgJsonMatch('file1.ts', 1, 'test 1')
      const match2 = createRgJsonMatch('file2.ts', 2, 'test 2')
      const match3 = createRgJsonMatch('file3.ts', 3, 'test 3')

      // Send as one chunk without trailing newline to simulate remainder scenario
      const output = `${match1}\n${match2}\n${match3}`

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      // All three matches should be processed
      expect(value.stdout).toContain('file1.ts:')
      expect(value.stdout).toContain('file2.ts:')
      expect(value.stdout).toContain('file3.ts:')
    })

    it('should enforce output size limit during streaming (regression test)', async () => {
      // Bug: Output size only checked at end, could exceed limit
      // Fix: Check estimatedOutputLen during streaming and stop early
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'test',
        maxOutputStringLength: 200, // Very small limit
        globalMaxResults: 1000, // Set high so output size limit is hit first
        maxResults: 1000, // Set high so per-file limit doesn't interfere
      })

      // Generate matches with long content to quickly exceed output size
      const matches: string[] = []
      for (let i = 0; i < 20; i++) {
        matches.push(
          createRgJsonMatch(
            'file.ts',
            i,
            `test line ${i} with some content that is quite long to fill up the buffer quickly`,
          ),
        )
      }
      const output = matches.join('\n')

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      // Should have limited output - either by early stop or final truncation
      // The output should be truncated and not contain all 20 matches
      const matchCount = (value.stdout!.match(/test line \d+/g) || []).length
      expect(matchCount).toBeLessThan(20)
      // Should indicate truncation happened
      const hasTruncationMessage =
        value.stdout!.includes('truncated') ||
        value.stdout!.includes('limit reached') ||
        value.stdout!.includes('Output size limit')
      expect(hasTruncationMessage).toBe(true)
    })

    it('reports unsupported byte paths instead of fabricating filenames', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'test',
      })

      // Simulate ripgrep JSON with path.bytes instead of path.text
      const output = JSON.stringify({
        type: 'match',
        data: {
          path: { bytes: Buffer.from('file-with-bytes.ts').toString('base64') },
          lines: { text: 'test content' },
          line_number: 1,
        },
      })

      mockProcess.stdout.emit('data', Buffer.from(output))
      mockProcess.emit('close', 0)

      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      expect(value.errorMessage).toContain('1 event line(s)')
      expect(value.stdout).not.toContain('Found 0 matches')
    })

    it('preserves UTF-8 characters split across process chunks', async () => {
      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'café',
      })
      const output = Buffer.from(createRgJsonMatch('café.ts', 1, 'café'))
      const splitAt = output.indexOf(Buffer.from('é')) + 1
      mockProcess.stdout.emit('data', output.subarray(0, splitAt))
      mockProcess.stdout.emit('data', output.subarray(splitAt))
      mockProcess.emit('close', 0)
      const value = asCodeSearchResult((await searchPromise)[0])
      expect(value.stdout).toContain('café.ts:')
      expect(value.stdout).toContain('café')
      expect(value.stdout).not.toContain('�')
    })
  })

  describe('timeout handling', () => {
    it('should timeout after specified seconds', async () => {
      // Create a mock process that doesn't auto-emit close when killed
      // to properly test the timeout path
      const slowMockProcess = createMockChildProcess()
      // Override kill to not emit close (simulating a hung process)
      slowMockProcess.kill = mock(() => {
        slowMockProcess.killed = true
        return true
      })

      const slowMockSpawn = mock(() => slowMockProcess)
      await mockModule('child_process', () => ({
        spawn: slowMockSpawn,
      }))

      const searchPromise = codeSearch({
        projectPath: process.cwd(),
        pattern: 'test',
        timeoutSeconds: 1,
      })

      // Don't emit any data - just wait for the timeout to trigger
      const result = await searchPromise
      const value = asCodeSearchResult(result[0])

      // Should have timed out with an error message
      expect(value.errorMessage).toBeDefined()
      expect(value.errorMessage).toContain('timed out')
    })
  })
})

/**
 * Implementor-helpers tests — extraction + diff-stat surface.
 *
 * FID-2026-0819-005 Loop 315: split of the 1487-line monolith. This module
 * keeps extractValueForKey / extractFilePath / parseDiffStats; the diff
 * construction, file-change, timeline, identity, grouping, and multi-prompt
 * suites live in focused sibling modules.
 */
import { describe, expect, test } from 'bun:test'

import {
  extractValueForKey,
  extractFilePath,
  parseDiffStats,
} from '../implementor-helpers'

import type { ToolContentBlock } from '../../types/chat'

describe('extractValueForKey', () => {
  test('extracts simple key-value pairs', () => {
    const output = 'file: src/utils/helper.ts\nmessage: Updated file'
    expect(extractValueForKey(output, 'file')).toBe('src/utils/helper.ts')
    expect(extractValueForKey(output, 'message')).toBe('Updated file')
  })

  test('handles quoted values', () => {
    const output = 'message: "Created new file"'
    expect(extractValueForKey(output, 'message')).toBe('Created new file')
  })

  test('returns null for missing keys', () => {
    const output = 'file: test.ts'
    expect(extractValueForKey(output, 'nonexistent')).toBeNull()
  })

  test('handles empty output', () => {
    expect(extractValueForKey('', 'file')).toBeNull()
  })

  test('handles multi-line values with pipe', () => {
    const output = `unifiedDiff: |\n  - old line\n  + new line`
    const result = extractValueForKey(output, 'unifiedDiff')
    expect(result).toBe('- old line\n+ new line')
  })
})

describe('extractFilePath', () => {
  test('extracts from output string', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'str_replace',
      input: {},
      output: 'file: src/utils/test.ts\nmessage: Updated',
    }
    expect(extractFilePath(block)).toBe('src/utils/test.ts')
  })

  test('extracts from input.path', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'str_replace',
      input: { path: 'src/components/Button.tsx' },
      output: '',
    }
    expect(extractFilePath(block)).toBe('src/components/Button.tsx')
  })

  test('prefers output over input', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'str_replace',
      input: { path: 'input-path.ts' },
      output: 'file: output-path.ts',
    }
    expect(extractFilePath(block)).toBe('output-path.ts')
  })
})

describe('parseDiffStats', () => {
  test('counts additions and deletions', () => {
    const diff = `@@ -1,3 +1,4 @@\n unchanged\n-removed line\n+added line 1\n+added line 2`
    const stats = parseDiffStats(diff)
    expect(stats.linesAdded).toBe(2)
    expect(stats.linesRemoved).toBe(1)
    expect(stats.hunks).toBe(1)
  })

  test('counts multiple hunks', () => {
    const diff = `@@ -1,3 +1,3 @@\n-old1\n+new1\n@@ -10,3 +10,3 @@\n-old2\n+new2`
    const stats = parseDiffStats(diff)
    expect(stats.hunks).toBe(2)
  })

  test('handles empty diff', () => {
    expect(parseDiffStats(undefined)).toEqual({
      linesAdded: 0,
      linesRemoved: 0,
      hunks: 0,
    })
    expect(parseDiffStats('')).toEqual({
      linesAdded: 0,
      linesRemoved: 0,
      hunks: 0,
    })
  })

  test('ignores +++ and --- headers', () => {
    const diff = `--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new`
    const stats = parseDiffStats(diff)
    expect(stats.linesAdded).toBe(1)
    expect(stats.linesRemoved).toBe(1)
  })
})

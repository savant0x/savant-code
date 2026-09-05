import { describe, expect, test } from 'bun:test'

import {
  extractDiff,
  getFileChangeType,
  getFileStatsFromBlocks,
  shouldShowEditDiff,
} from '../implementor-helpers'

import type { ContentBlock, ToolContentBlock } from '../../types/chat'

describe('getFileChangeType', () => {
  test('returns A for new file creation', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'write_file',
      input: {},
      output: 'message: Created new file',
    }
    expect(getFileChangeType(block)).toBe('A')
  })

  test('returns A for successful file creation', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'write_file',
      input: {},
      output: 'message: Created file successfully.',
    }
    expect(getFileChangeType(block)).toBe('A')
  })

  test('returns M for write_file modification', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'write_file',
      input: {},
      output: 'message: Updated file',
    }
    expect(getFileChangeType(block)).toBe('M')
  })

  test('returns M for str_replace', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'str_replace',
      input: {},
    }
    expect(getFileChangeType(block)).toBe('M')
  })

  test('returns A for propose_write_file new file', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'propose_write_file',
      input: {},
      output: 'message: Proposed new file src/new.ts',
    }
    expect(getFileChangeType(block)).toBe('A')
  })

  test('returns M for propose_str_replace', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'propose_str_replace',
      input: {},
    }
    expect(getFileChangeType(block)).toBe('M')
  })
})

describe('shouldShowEditDiff', () => {
  test('does not show pending str_replace diffs before the result arrives', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'str_replace',
      input: {
        replacements: [{ oldString: 'const x = 1', newString: 'const x = 2' }],
      },
    }

    expect(shouldShowEditDiff(block)).toBe(false)
  })

  test('shows str_replace diffs after a successful result', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'str_replace',
      input: {
        replacements: [{ oldString: 'const x = 1', newString: 'const x = 2' }],
      },
      output:
        'file: src/existing.ts\nmessage: String replace applied successfully.',
    }

    expect(shouldShowEditDiff(block)).toBe(true)
  })

  test('does not show pending write_file diffs before the result arrives', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'write_file',
      input: { path: 'src/new.ts', content: 'const x = 1\n' },
    }

    expect(extractDiff(block)).toBe('+ const x = 1\n+ ')
    expect(shouldShowEditDiff(block)).toBe(false)
  })

  test('shows write_file diffs after an overwrite result', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'write_file',
      input: { path: 'src/existing.ts', content: 'const x = 2\n' },
      output: 'file: src/existing.ts\nmessage: Overwrote file successfully.',
    }

    expect(shouldShowEditDiff(block)).toBe(true)
  })

  test('does not show write_file diffs after a create result', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'write_file',
      input: { path: 'src/new.ts', content: 'const x = 1\n' },
      output: 'file: src/new.ts\nmessage: Created file successfully.',
    }

    expect(shouldShowEditDiff(block)).toBe(false)
  })

  test('continues to show pending proposed write_file diffs', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'propose_write_file',
      input: { path: 'src/new.ts', content: 'const x = 1\n' },
    }

    expect(shouldShowEditDiff(block)).toBe(true)
  })
})

describe('getFileStatsFromBlocks', () => {
  test('aggregates stats for same file', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        toolCallId: 'test-1',
        toolName: 'str_replace',
        input: { path: 'file.ts' },
        outputRaw: [{ type: 'json', value: { unifiedDiff: '+line1\n+line2' } }],
      },
      {
        type: 'tool',
        toolCallId: 'test-2',
        toolName: 'str_replace',
        input: { path: 'file.ts' },
        outputRaw: [
          { type: 'json', value: { unifiedDiff: '+line3\n-removed' } },
        ],
      },
    ]
    const stats = getFileStatsFromBlocks(blocks)
    expect(stats).toHaveLength(1)
    expect(stats[0].path).toBe('file.ts')
    expect(stats[0].stats.linesAdded).toBe(3)
    expect(stats[0].stats.linesRemoved).toBe(1)
  })

  test('separates different files', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        toolCallId: 'test-1',
        toolName: 'str_replace',
        input: { path: 'file1.ts' },
        outputRaw: [{ type: 'json', value: { unifiedDiff: '+added' } }],
      },
      {
        type: 'tool',
        toolCallId: 'test-2',
        toolName: 'str_replace',
        input: { path: 'file2.ts' },
        outputRaw: [{ type: 'json', value: { unifiedDiff: '-removed' } }],
      },
    ]
    const stats = getFileStatsFromBlocks(blocks)
    expect(stats).toHaveLength(2)
  })

  test('ignores non-edit tools', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        toolCallId: 'test-1',
        toolName: 'read_files',
        input: { paths: ['file.ts'] },
      },
    ]
    const stats = getFileStatsFromBlocks(blocks)
    expect(stats).toHaveLength(0)
  })

  test('ignores failed edit tools', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        toolCallId: 'test-1',
        toolName: 'str_replace',
        input: {
          path: 'file.ts',
          replacements: [
            { oldString: 'const x = 1', newString: 'const x = 2' },
          ],
        },
        output: 'No change to the file',
      },
    ]
    const stats = getFileStatsFromBlocks(blocks)
    expect(stats).toHaveLength(0)
  })
})

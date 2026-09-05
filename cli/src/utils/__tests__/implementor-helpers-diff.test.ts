import { describe, expect, test } from 'bun:test'

import { extractDiff, parseDiffStats } from '../implementor-helpers'

import type { ToolContentBlock } from '../../types/chat'

describe('extractDiff', () => {
  test('extracts from outputRaw array format', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'str_replace',
      input: {},
      outputRaw: [{ type: 'json', value: { unifiedDiff: '- old\n+ new' } }],
    }
    expect(extractDiff(block)).toBe('- old\n+ new')
  })

  test('constructs diff from str_replace input', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'str_replace',
      input: {
        replacements: [{ oldString: 'const x = 1', newString: 'const x = 2' }],
      },
    }
    const diff = extractDiff(block)
    expect(diff).toContain('- const x = 1')
    expect(diff).toContain('+ const x = 2')
  })

  test('constructs diff from successful str_replace input when output omits diff', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'str_replace',
      input: {
        replacements: [{ oldString: 'const x = 1', newString: 'const x = 2' }],
      },
      output: 'message: String replace applied successfully.',
    }
    const diff = extractDiff(block)
    expect(diff).toContain('- const x = 1')
    expect(diff).toContain('+ const x = 2')
  })

  test('constructs diff from successful str_replace input with warning output', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'str_replace',
      input: {
        replacements: [{ oldString: 'const x = 1', newString: 'const x = 2' }],
      },
      output: `message: |\n  Matched with indentation modification\n\n  String replace applied successfully.`,
    }
    const diff = extractDiff(block)
    expect(diff).toContain('- const x = 1')
    expect(diff).toContain('+ const x = 2')
  })

  test('uses patch content from successful str_replace input when output omits diff', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'str_replace',
      input: { type: 'patch', content: '- const x = 1\n+ const x = 2' },
      output: 'message: String replace applied successfully.',
    }
    expect(extractDiff(block)).toBe('- const x = 1\n+ const x = 2')
  })

  test('returns null for failed str_replace output without a diff', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'str_replace',
      input: {
        replacements: [{ oldString: 'const x = 1', newString: 'const x = 2' }],
      },
      output: 'No change to the file',
    }
    expect(extractDiff(block)).toBeNull()
  })

  test('returns null for failed str_replace output even when it includes patch input', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'str_replace',
      input: { type: 'patch', content: '- const x = 1\n+ const x = 2' },
      outputRaw: [
        {
          type: 'json',
          value: {
            errorMessage: 'Failed to apply patch.',
            patch: '- const x = 1\n+ const x = 2',
          },
        },
      ],
    }
    expect(extractDiff(block)).toBeNull()
  })

  test('constructs diff from write_file input', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'write_file',
      input: { content: 'line1\nline2' },
    }
    const diff = extractDiff(block)
    expect(diff).toBe('+ line1\n+ line2')
  })

  test('constructs diff from successful write_file input when output omits diff', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'write_file',
      input: { content: 'line1\nline2' },
      output: 'message: Overwrote file successfully.',
    }
    const diff = extractDiff(block)
    expect(diff).toBe('+ line1\n+ line2')
  })

  test('returns null for failed write_file output without a diff', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'write_file',
      input: { content: 'line1\nline2' },
      output: 'Failed to write to file',
    }
    expect(extractDiff(block)).toBeNull()
  })

  test('constructs diff from propose_str_replace input', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'propose_str_replace',
      input: {
        replacements: [{ oldString: 'const x = 1', newString: 'const x = 2' }],
      },
    }
    const diff = extractDiff(block)
    expect(diff).toContain('- const x = 1')
    expect(diff).toContain('+ const x = 2')
  })

  test('constructs diff from propose_write_file input', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'propose_write_file',
      input: { content: 'line1\nline2' },
    }
    const diff = extractDiff(block)
    expect(diff).toBe('+ line1\n+ line2')
  })

  // FID-2026-0822-008: the generic input.content fallback must route through
  // constructDiffFromWriteFile so content-shaped payloads classify as
  // additions (correct +N -0 counts) instead of context rows that parse as
  // a zero-change receipt (+0 -0).
  test('constructs sign-prefixed diff from generic input.content fallback', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'str_replace',
      input: { content: 'plain line one\nplain line two' },
      output: 'message: String replace applied successfully.',
    }
    const diff = extractDiff(block)
    expect(diff).toBe('+ plain line one\n+ plain line two')
  })

  test('generic content fallback yields nonzero parseDiffLines counts', () => {
    const block: ToolContentBlock = {
      type: 'tool',
      toolCallId: 'test-1',
      toolName: 'write_file',
      input: { content: 'alpha\nbeta\ngamma' },
      output: 'message: Overwrote file successfully.',
    }
    const diff = extractDiff(block)
    const stats = parseDiffStats(diff ?? '')
    expect(stats.linesAdded).toBe(3)
    expect(stats.linesRemoved).toBe(0)
  })
})

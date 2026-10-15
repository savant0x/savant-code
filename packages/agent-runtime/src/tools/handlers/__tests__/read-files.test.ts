import { describe, expect, it } from 'bun:test'

import { sliceLines } from '../tool/read-files'

describe('sliceLines (read_files line ranges — FID-2026-0817-002 B2)', () => {
  const content = 'line1\nline2\nline3\nline4\n'

  it('returns content unchanged when offset and limit are omitted', () => {
    expect(sliceLines(content, undefined, undefined)).toBe(content)
  })

  it('reads from offset to the end when only offset is given', () => {
    expect(sliceLines(content, 3, undefined)).toBe('line3\nline4\n')
  })

  // LF-001 (FID-2026-1012-007): the window is now the SAME function the SDK
  // fetch boundary uses, and its boundaries are newline-exact — a window that
  // ends before EOF keeps the separator its successor starts from, so
  // paginated pages concatenate back to the original file. Only the trailing
  // separator of a mid-file window changed; every other case is unchanged.
  it('reads an exact offset+limit window with its separator', () => {
    expect(sliceLines(content, 2, 2)).toBe('line2\nline3\n')
  })

  it('reads the first line (offset 1, limit 1)', () => {
    expect(sliceLines(content, 1, 1)).toBe('line1\n')
  })

  it('reconstructs the file from consecutive pages', () => {
    expect(sliceLines(content, 1, 2) + sliceLines(content, 3, 2)).toBe(content)
  })

  it('returns an empty string when offset is past EOF (never fabricates lines)', () => {
    expect(sliceLines(content, 99, undefined)).toBe('')
  })

  it('clamps limit at the end of the file', () => {
    expect(sliceLines(content, 4, 100)).toBe('line4\n')
  })
})

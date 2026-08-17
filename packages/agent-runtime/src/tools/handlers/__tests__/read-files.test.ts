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

  it('reads an exact offset+limit window', () => {
    expect(sliceLines(content, 2, 2)).toBe('line2\nline3')
  })

  it('reads the first line (offset 1, limit 1)', () => {
    expect(sliceLines(content, 1, 1)).toBe('line1')
  })

  it('returns an empty string when offset is past EOF (never fabricates lines)', () => {
    expect(sliceLines(content, 99, undefined)).toBe('')
  })

  it('clamps limit at the end of the file', () => {
    expect(sliceLines(content, 4, 100)).toBe('line4\n')
  })
})

import crypto from 'node:crypto'

import { describe, expect, it } from 'bun:test'

import { extractLineWindow } from '../util/read-window'

// LF-001 (FID-2026-1012-007): the shared line window. Boundary rules are
// newline-exact so consecutive pages concatenate back to the original file —
// that is what makes paginated reads of a file past the read cap additive
// instead of lossy.
const digest = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex')

describe('extractLineWindow', () => {
  const content = 'line1\nline2\nline3\nline4\n'

  it('returns the whole content when no window is requested', () => {
    expect(extractLineWindow(content, undefined, undefined)).toBe(content)
  })

  it('reads from the offset to EOF when only offset is given', () => {
    expect(extractLineWindow(content, 3, undefined)).toBe('line3\nline4\n')
  })

  it('keeps the separator of a window that ends before EOF', () => {
    expect(extractLineWindow(content, 2, 2)).toBe('line2\nline3\n')
  })

  it('reads the first line as its own page', () => {
    expect(extractLineWindow(content, 1, 1)).toBe('line1\n')
  })

  it('returns an empty string past EOF (never fabricates lines)', () => {
    expect(extractLineWindow(content, 99, undefined)).toBe('')
    expect(extractLineWindow(content, 99, 10)).toBe('')
  })

  it('clamps a window at the end of the file', () => {
    expect(extractLineWindow(content, 4, 100)).toBe('line4\n')
  })

  it('returns an empty page for a non-positive limit', () => {
    expect(extractLineWindow(content, 2, 0)).toBe('')
  })

  it('reconstructs a file lacking a trailing newline', () => {
    const noTrailingNewline = 'a\nb'
    const rebuilt =
      extractLineWindow(noTrailingNewline, 1, 1) +
      extractLineWindow(noTrailingNewline, 2, 1)
    expect(rebuilt).toBe(noTrailingNewline)
  })

  it('reconstructs a >100k-character file from overlapping pages with a matching SHA-256', () => {
    const lines = Array.from(
      { length: 4000 },
      (_, index) => `line ${index + 1} ${'x'.repeat(24)}`,
    )
    const large = `${lines.join('\n')}\n`
    expect(large.length).toBeGreaterThan(100_000)

    const pages: string[] = []
    for (let start = 1; start <= lines.length; start += 137) {
      pages.push(extractLineWindow(large, start, 137))
    }
    const rebuilt = pages.join('')

    expect(rebuilt).toBe(large)
    expect(digest(rebuilt)).toBe(digest(large))
  })
})

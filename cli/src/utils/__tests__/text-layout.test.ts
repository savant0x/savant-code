import { describe, test, expect } from 'bun:test'

import { computeInputLayoutMetrics, getLastNVisualLines } from '../text-layout'

describe('computeInputLayoutMetrics', () => {
  test('single-line content keeps height at 1 without gutter', () => {
    const metrics = computeInputLayoutMetrics({
      layoutContent: 'hello world',
      cursorProbe: 'hello world',
      cols: 40,
      maxHeight: 5,
    })

    expect(metrics.heightLines).toBe(1)
    expect(metrics.gutterEnabled).toBe(false)
  })

  test('counts leading indentation toward wrapped line width', () => {
    const metrics = computeInputLayoutMetrics({
      layoutContent: '    indent',
      cursorProbe: '    indent',
      cols: 8,
      maxHeight: 2,
    })

    expect(metrics.heightLines).toBe(2)
    expect(metrics.gutterEnabled).toBe(false)
  })

  test('adds gutter when two lines and cursor on second line', () => {
    const layoutContent = 'first line\nsecond line'
    const cursorProbe = 'first line\nsecond line'

    const metrics = computeInputLayoutMetrics({
      layoutContent,
      cursorProbe,
      cols: 40,
      maxHeight: 5,
    })

    expect(metrics.heightLines).toBe(3)
    expect(metrics.gutterEnabled).toBe(true)
  })

  test('omits gutter when maxHeight would be exceeded', () => {
    const metrics = computeInputLayoutMetrics({
      layoutContent: 'a long first line\nand a second line',
      cursorProbe: 'a long first line\nand a second line',
      cols: 80,
      maxHeight: 2,
    })

    expect(metrics.heightLines).toBe(2)
    expect(metrics.gutterEnabled).toBe(false)
  })

  test('respects a minimum height constraint', () => {
    const metrics = computeInputLayoutMetrics({
      layoutContent: 'short',
      cursorProbe: 'short',
      cols: 40,
      maxHeight: 5,
      minHeight: 3,
    })

    expect(metrics.heightLines).toBe(3)
    expect(metrics.gutterEnabled).toBe(false)
  })

  test('caps the minimum height at the max height', () => {
    const metrics = computeInputLayoutMetrics({
      layoutContent: 'tiny',
      cursorProbe: 'tiny',
      cols: 40,
      maxHeight: 2,
      minHeight: 5,
    })

    expect(metrics.heightLines).toBe(2)
    expect(metrics.gutterEnabled).toBe(false)
  })
})

describe('getLastNVisualLines (FID-2026-0822-010)', () => {
  test('default: keeps hard char-split rows so gutter slices stay exact-width', () => {
    const text = 'aa bb cc-very-long-token-that-overflows dd'
    const { lines } = getLastNVisualLines(text, 12, 10)

    // The oversize token is char-split with no marker (existing behavior).
    expect(lines.some((line) => line.length === 12)).toBe(true)
    expect(lines.join('\n')).not.toContain('…')
  })

  test('ellipsizeMidWordCuts: mid-word rows trim to the last word boundary + marker', () => {
    const text = 'aa bb cc-very-long-token-that-overflows dd'
    const { lines } = getLastNVisualLines(text, 12, 10, {
      ellipsizeMidWordCuts: true,
    })

    const joined = lines.join('\n')
    // Rows that end mid-word carry a visible ellipsis marker.
    expect(joined).toContain('…')
    // No INTERMEDIATE row ends with a bare word fragment: the final row may
    // legitimately end with the oversize token's tail + remaining words.
    for (const line of lines.slice(0, -1)) {
      const trimmed = line.trimEnd()
      if (/[\p{L}\p{N}]/u.test(trimmed[trimmed.length - 1] ?? '')) {
        expect(line).toMatch(/…\s*$/)
      }
    }
  })

  test('ellipsizeMidWordCuts: clean word-boundary wraps get no marker', () => {
    const text = 'one two three four five six seven eight nine ten'
    const { lines } = getLastNVisualLines(text, 12, 10, {
      ellipsizeMidWordCuts: true,
    })

    // All tokens are short: wrapping happens at word boundaries only.
    expect(lines.join('\n')).not.toContain('…')
  })

  test('ellipsizeMidWordCuts: single unbroken fragment keeps a marker', () => {
    const text = 'abcdefghijklmnopqrstuvwxyz'
    const { lines } = getLastNVisualLines(text, 10, 5, {
      ellipsizeMidWordCuts: true,
    })

    const joined = lines.join('\n')
    expect(joined).toContain('…')
    // The final row is the token tail (complete), earlier rows are marked.
    const lastLine = lines[lines.length - 1]
    expect(lastLine).toBe('uvwxyz')
  })

  test('ellipsizeMidWordCuts: windowed preview keeps hasMore semantics', () => {
    const text =
      'first second third fourth fifth sixth seventh eighth ninth tenth'
    const { lines, hasMore } = getLastNVisualLines(text, 12, 3, {
      ellipsizeMidWordCuts: true,
    })

    expect(lines.length).toBe(3)
    expect(hasMore).toBe(true)
  })
})

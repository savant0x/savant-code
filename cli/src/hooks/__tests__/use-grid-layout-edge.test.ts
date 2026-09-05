import { describe, test, expect } from 'bun:test'

import { computeGridLayout } from '../use-grid-layout'

// FID-2026-0819-005 Loop 196: edge-case and consistency suites moved
// verbatim from use-grid-layout.test.ts.

describe('computeGridLayout — edge cases and consistency', () => {
  describe('edge cases', () => {
    test('very small availableWidth (< MIN_COLUMN_WIDTH)', () => {
      const result = computeGridLayout(['a', 'b'], 5)
      expect(result.columns).toBe(1)
      expect(result.columnWidth).toBe(5)
    })

    test('zero availableWidth clamps columnWidth to 1', () => {
      const result = computeGridLayout(['a'], 0)
      expect(result.columns).toBe(1)
      // columnWidth is clamped to at least 1 to prevent layout issues
      expect(result.columnWidth).toBe(1)
    })

    test('negative availableWidth clamps columnWidth to 1', () => {
      const result = computeGridLayout(['a'], -10)
      expect(result.columns).toBe(1)
      // columnWidth is clamped to at least 1 to prevent layout issues
      expect(result.columnWidth).toBe(1)
    })

    test('large number of items', () => {
      const items = Array.from({ length: 100 }, (_, i) => i)
      const result = computeGridLayout(items, 250)
      expect(result.columns).toBe(4)
      expect(result.columnGroups.length).toBe(4)
      expect(result.columnGroups.flat().length).toBe(100)
    })

    test('fractional availableWidth is floored for columnWidth', () => {
      const result = computeGridLayout(['a', 'b'], 121)
      // (121 - 1) / 2 = 60
      expect(result.columnWidth).toBe(60)
    })
  })

  describe('consistency', () => {
    test('same input always produces same output', () => {
      const items = ['a', 'b', 'c', 'd']
      const width = 150

      const result1 = computeGridLayout(items, width)
      const result2 = computeGridLayout(items, width)
      const result3 = computeGridLayout(items, width)

      expect(result1.columns).toBe(result2.columns)
      expect(result2.columns).toBe(result3.columns)
      expect(result1.columnWidth).toBe(result2.columnWidth)
      expect(result1.columnGroups).toEqual(result2.columnGroups)
    })

    test('deterministic across all threshold boundaries', () => {
      const items = ['a', 'b', 'c', 'd']
      const boundaries = [99, 100, 149, 150, 199, 200, 250]

      for (const width of boundaries) {
        const result1 = computeGridLayout(items, width)
        const result2 = computeGridLayout(items, width)
        expect(result1.columns).toBe(result2.columns)
      }
    })
  })
})

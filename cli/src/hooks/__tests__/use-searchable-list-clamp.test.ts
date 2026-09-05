import { describe, test, expect } from 'bun:test'

// FID-2026-0819-005 Loop 217: clampFocusIndex and integration-scenario
// suites moved verbatim from use-searchable-list.test.ts; the extracted
// clampFocusIndex/filterItems helpers and TestItem interface copied
// verbatim.

interface TestItem {
  id: string
  label: string
}

// Extract the default filter function for testing
const defaultFilterFn = (item: TestItem, query: string): boolean =>
  item.label.toLowerCase().includes(query.toLowerCase())

// Extract the filter logic for testing
const filterItems = <T extends TestItem>(
  items: T[],
  query: string,
  filterFn: (item: T, query: string) => boolean = defaultFilterFn,
): T[] => {
  if (!query.trim()) return items
  return items.filter((item) => filterFn(item, query))
}

// Extract the focus index clamping logic for testing
const clampFocusIndex = (focusedIndex: number, listLength: number): number => {
  if (focusedIndex >= listLength) {
    return Math.max(0, listLength - 1)
  }
  return focusedIndex
}

describe('useSearchableList - clampFocusIndex', () => {
  describe('when index is within bounds', () => {
    test('returns index unchanged when within bounds', () => {
      expect(clampFocusIndex(2, 5)).toBe(2)
    })

    test('returns 0 when index is 0 and list has items', () => {
      expect(clampFocusIndex(0, 5)).toBe(0)
    })

    test('returns last index when at last position', () => {
      expect(clampFocusIndex(4, 5)).toBe(4)
    })
  })

  describe('when index exceeds bounds', () => {
    test('clamps to last index when focusedIndex equals length', () => {
      expect(clampFocusIndex(5, 5)).toBe(4)
    })

    test('clamps to last index when focusedIndex exceeds length', () => {
      expect(clampFocusIndex(10, 5)).toBe(4)
    })

    test('clamps to 0 when list becomes empty', () => {
      expect(clampFocusIndex(5, 0)).toBe(0)
    })

    test('clamps to 0 when focusedIndex is large and list is empty', () => {
      expect(clampFocusIndex(100, 0)).toBe(0)
    })
  })

  describe('single item list', () => {
    test('returns 0 for single item list when index is 0', () => {
      expect(clampFocusIndex(0, 1)).toBe(0)
    })

    test('clamps to 0 for single item list when index exceeds', () => {
      expect(clampFocusIndex(5, 1)).toBe(0)
    })
  })

  describe('edge cases', () => {
    test('handles negative index (returns as-is since not >= length)', () => {
      // The clamping logic only handles index >= length
      // Negative indices are returned unchanged
      expect(clampFocusIndex(-1, 5)).toBe(-1)
    })

    test('handles very large list length', () => {
      expect(clampFocusIndex(999, 1000)).toBe(999)
      expect(clampFocusIndex(1000, 1000)).toBe(999)
    })
  })
})

describe('useSearchableList - integration scenarios', () => {
  const items: TestItem[] = [
    { id: '1', label: 'alpha' },
    { id: '2', label: 'beta' },
    { id: '3', label: 'gamma' },
    { id: '4', label: 'delta' },
    { id: '5', label: 'epsilon' },
  ]

  test('scenario: filter reduces list and clamp adjusts index', () => {
    // Start with focusedIndex = 4 (epsilon)
    let focusedIndex = 4

    // Filter to items containing 'a' -> [alpha, beta, gamma, delta] (beta contains 'a')
    const filtered = filterItems(items, 'a')
    expect(filtered).toHaveLength(4)

    // Clamp the focus index
    focusedIndex = clampFocusIndex(focusedIndex, filtered.length)
    expect(focusedIndex).toBe(3) // Clamped to last index (4-1=3)
  })

  test('scenario: filter to empty list clamps to 0', () => {
    let focusedIndex = 2

    const filtered = filterItems(items, 'xyz')
    expect(filtered).toHaveLength(0)

    focusedIndex = clampFocusIndex(focusedIndex, filtered.length)
    expect(focusedIndex).toBe(0)
  })

  test('scenario: clearing filter restores full list', () => {
    // First filter - 'a' matches alpha, beta, gamma, delta
    let filtered = filterItems(items, 'a')
    expect(filtered).toHaveLength(4)

    // Clear filter
    filtered = filterItems(items, '')
    expect(filtered).toHaveLength(5)
    expect(filtered).toEqual(items)
  })

  test('scenario: progressive filtering narrows results', () => {
    // 'a' matches alpha, beta, gamma, delta (all contain 'a')
    let filtered = filterItems(items, 'a')
    expect(filtered.map((i) => i.label)).toEqual([
      'alpha',
      'beta',
      'gamma',
      'delta',
    ])

    // 'al' only matches alpha
    filtered = filterItems(items, 'al')
    expect(filtered.map((i) => i.label)).toEqual(['alpha'])

    // 'alp' still only matches alpha
    filtered = filterItems(items, 'alp')
    expect(filtered.map((i) => i.label)).toEqual(['alpha'])
  })
})

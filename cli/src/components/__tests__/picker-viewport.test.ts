import { describe, expect, test } from 'bun:test'

import {
  getPickerViewport,
  normalizeSelectableIndex,
  PICKER_MAX_VISIBLE_ROWS,
  PICKER_RESERVED_TERMINAL_ROWS,
} from '../picker-viewport'

describe('picker viewport', () => {
  test('uses all rows when the catalog fits', () => {
    const viewport = getPickerViewport(40, 5)

    expect(viewport.visibleRows).toBe(5)
    expect(viewport.needsScroll).toBe(false)
    expect(viewport.start).toBe(0)
    expect(viewport.end).toBe(5)
  })

  test('bounds large catalogs and keeps the selected row visible', () => {
    const viewport = getPickerViewport(40, 30, 20)

    expect(viewport.visibleRows).toBe(PICKER_MAX_VISIBLE_ROWS)
    expect(viewport.needsScroll).toBe(true)
    expect(viewport.start).toBeGreaterThan(0)
    expect(viewport.start).toBeLessThanOrEqual(20)
    expect(viewport.start).toBeLessThanOrEqual(20)
    expect(20).toBeLessThan(viewport.end)
  })

  test('reserves the bottom-panel terminal budget', () => {
    const viewport = getPickerViewport(PICKER_RESERVED_TERMINAL_ROWS + 2, 20)

    expect(viewport.visibleRows).toBe(2)
    expect(viewport.needsScroll).toBe(true)
  })

  test('keeps a one-row usable viewport for very short terminals', () => {
    const viewport = getPickerViewport(1, 20)

    expect(viewport.visibleRows).toBe(1)
    expect(viewport.needsScroll).toBe(true)
  })
})

describe('normalizeSelectableIndex', () => {
  test('moves a header selection to the next model', () => {
    expect(normalizeSelectableIndex(0, 3, (index) => index !== 0)).toBe(1)
  })

  test('does not return a header when the selected index is out of range', () => {
    expect(
      normalizeSelectableIndex(99, 4, (index) => index === 1 || index === 3),
    ).toBe(3)
  })

  test('returns zero for an empty list', () => {
    expect(normalizeSelectableIndex(3, 0, () => true)).toBe(0)
  })
})

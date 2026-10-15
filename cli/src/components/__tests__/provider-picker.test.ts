import { describe, expect, test } from 'bun:test'

import { getPickerViewport } from '../picker-viewport'

describe('provider picker viewport contract', () => {
  test('uses the shared viewport for a provider list that exceeds the terminal budget', () => {
    const viewport = getPickerViewport(18, 10, 8)

    expect(viewport.needsScroll).toBe(true)
    expect(viewport.start).toBeGreaterThan(0)
    expect(viewport.end).toBe(10)
  })

  test('keeps a short provider list fully visible', () => {
    const viewport = getPickerViewport(40, 6)

    expect(viewport.needsScroll).toBe(false)
    expect(viewport.visibleRows).toBe(6)
  })
})

import { describe, test, expect } from 'bun:test'
import React, { useCallback } from 'react'
import { renderToString } from 'react-dom/server'

import { GridLayout } from '../grid-layout'

// FID-2026-0819-005 Loop 219: unified-DOM-structure suite moved verbatim
// from grid-layout.integration.test.tsx; helpers (TestItem,
// createTestItem, RenderTracker, createRenderTracker, TrackedGridLayout)
// copied verbatim.

interface TestItem {
  id: string
  name: string
}

const createTestItem = (id: string, name: string): TestItem => ({ id, name })

/**
 * Test wrapper that simulates resize by rendering at multiple widths
 * and tracking which items were rendered at each width.
 */
interface RenderTracker {
  renderedItems: Map<number, string[]> // width -> item names rendered
  renderCounts: Map<string, number> // item id -> render count
}

function createRenderTracker(): RenderTracker {
  return {
    renderedItems: new Map(),
    renderCounts: new Map(),
  }
}

/**
 * Component that renders GridLayout and tracks rendered items.
 * This simulates what happens during actual React reconciliation.
 */
function TrackedGridLayout({
  items,
  availableWidth,
  tracker,
}: {
  items: TestItem[]
  availableWidth: number
  tracker: RenderTracker
}) {
  const renderItem = useCallback(
    (item: TestItem, _idx: number, _columnWidth: number) => {
      // Track this item was rendered
      const currentCount = tracker.renderCounts.get(item.id) || 0
      tracker.renderCounts.set(item.id, currentCount + 1)

      // Track items rendered at this width
      const widthItems = tracker.renderedItems.get(availableWidth) || []
      if (!widthItems.includes(item.name)) {
        widthItems.push(item.name)
        tracker.renderedItems.set(availableWidth, widthItems)
      }

      return <text key={item.id}>{item.name}</text>
    },
    [availableWidth, tracker],
  )

  const getItemKey = useCallback((item: TestItem) => item.id, [])

  return (
    <GridLayout
      items={items}
      availableWidth={availableWidth}
      getItemKey={getItemKey}
      renderItem={renderItem}
    />
  )
}

describe('GridLayout React Reconciliation', () => {
  describe('unified DOM structure verification', () => {
    test('both column layouts produce valid markup', () => {
      const items = [createTestItem('a', 'Item1'), createTestItem('b', 'Item2')]

      // 2-column layout
      const twoColMarkup = renderToString(
        <GridLayout
          items={items}
          availableWidth={120}
          getItemKey={(item) => item.id}
          renderItem={(item) => <text>{item.name}</text>}
        />,
      )

      // 1-column layout
      const oneColMarkup = renderToString(
        <GridLayout
          items={items}
          availableWidth={80}
          getItemKey={(item) => item.id}
          renderItem={(item) => <text>{item.name}</text>}
        />,
      )

      // Both should produce valid, non-empty markup
      expect(twoColMarkup.length).toBeGreaterThan(0)
      expect(oneColMarkup.length).toBeGreaterThan(0)

      // Both should contain the items
      expect(twoColMarkup).toContain('Item1')
      expect(twoColMarkup).toContain('Item2')
      expect(oneColMarkup).toContain('Item1')
      expect(oneColMarkup).toContain('Item2')
    })

    test('no items lost even with dramatic width reduction', () => {
      const items = Array.from({ length: 10 }, (_, i) =>
        createTestItem(`item-${i}`, `Content${i}`),
      )
      const tracker = createRenderTracker()

      // Start at 4-column width (200+)
      renderToString(
        <TrackedGridLayout
          items={items}
          availableWidth={250}
          tracker={tracker}
        />,
      )

      // Dramatically reduce to 1-column
      const finalMarkup = renderToString(
        <TrackedGridLayout
          items={items}
          availableWidth={50}
          tracker={tracker}
        />,
      )

      // All 10 items should be present
      for (let i = 0; i < 10; i++) {
        expect(finalMarkup).toContain(`Content${i}`)
      }
    })
  })
})

// GridLayout — edge cases (extreme widths, many items, special characters)
// and memoization consistency.
// Sibling of the Loop 326 decomposition (shared fixtures in
// ./grid-layout-test-fixtures).

import { describe, test, expect } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { GridLayout } from '../grid-layout'
import {
  createTestItem,
  defaultGetItemKey,
  defaultRenderItem,
} from './grid-layout-test-fixtures'

describe('GridLayout - edge cases', () => {
  test('handles very narrow width', () => {
    const items = [createTestItem('item-1', 'Narrow')]

    const markup = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={10}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    expect(markup).toContain('Narrow')
  })

  test('handles many items', () => {
    const items = Array.from({ length: 50 }, (_, i) =>
      createTestItem(`item-${i}`, `Item ${i}`),
    )

    const markup = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={200}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    expect(markup).toContain('Item 0')
    expect(markup).toContain('Item 49')
  })

  test('handles items with special characters in names', () => {
    const items = [
      createTestItem('special-1', '<script>alert("xss")</script>'),
      createTestItem('special-2', 'Item & More'),
    ]

    const markup = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={120}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    // React escapes HTML entities
    expect(markup).toContain('&lt;script&gt;')
    expect(markup).toContain('&amp;')
  })

  test('handles undefined footer gracefully', () => {
    const items = [createTestItem('item-1', 'Item')]

    const markup = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={120}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
        footer={undefined}
      />,
    )

    expect(markup).toContain('Item')
  })
})

describe('GridLayout - memoization', () => {
  test('component is memoized', () => {
    // MasonryGrid is wrapped in memo(), verify it renders consistently
    const items = [createTestItem('memo-test', 'Memoized')]

    const markup1 = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={120}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    const markup2 = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={120}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    expect(markup1).toBe(markup2)
  })
})

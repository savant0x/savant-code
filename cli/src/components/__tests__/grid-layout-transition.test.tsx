// GridLayout — 2→1 column transition regression tests (resize bug fix).
// These tests verify the fix for the resize bug where content would
// disappear when transitioning from 2 columns to 1 column during terminal
// resize. The fix uses a unified DOM structure for all column counts.
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

describe('GridLayout - column transition (2→1)', () => {
  test('all items render when transitioning from 2-column to 1-column width', () => {
    const items = [
      createTestItem('a', 'Alpha'),
      createTestItem('b', 'Beta'),
      createTestItem('c', 'Gamma'),
    ]

    // First render at 2-column width (120 is in the 100-149 range = 2 columns max)
    const twoColumnMarkup = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={120}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    // Then render at 1-column width (80 is below 100 = 1 column)
    const oneColumnMarkup = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={80}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    // All items should be present in both renders
    expect(twoColumnMarkup).toContain('Alpha')
    expect(twoColumnMarkup).toContain('Beta')
    expect(twoColumnMarkup).toContain('Gamma')

    expect(oneColumnMarkup).toContain('Alpha')
    expect(oneColumnMarkup).toContain('Beta')
    expect(oneColumnMarkup).toContain('Gamma')
  })

  test('items maintain correct order during 2→1 transition', () => {
    const items = [
      createTestItem('a', 'First'),
      createTestItem('b', 'Second'),
      createTestItem('c', 'Third'),
      createTestItem('d', 'Fourth'),
    ]

    // Render at 1-column width (simulating post-transition state)
    const markup = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={80}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    const firstPos = markup.indexOf('First')
    const secondPos = markup.indexOf('Second')
    const thirdPos = markup.indexOf('Third')
    const fourthPos = markup.indexOf('Fourth')

    // Items should be in order in single-column mode
    expect(firstPos).toBeLessThan(secondPos)
    expect(secondPos).toBeLessThan(thirdPos)
    expect(thirdPos).toBeLessThan(fourthPos)
  })

  test('same items rendered in both 2-column and 1-column layouts', () => {
    const items = [
      createTestItem('item-1', 'Apple'),
      createTestItem('item-2', 'Banana'),
      createTestItem('item-3', 'Cherry'),
    ]

    const twoColumnMarkup = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={120}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    const oneColumnMarkup = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={80}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    // Extract item names from both renders - they should be identical sets
    const itemNames = ['Apple', 'Banana', 'Cherry']
    for (const name of itemNames) {
      expect(twoColumnMarkup).toContain(name)
      expect(oneColumnMarkup).toContain(name)
    }
  })

  test('transition works with 2 items', () => {
    const items = [createTestItem('a', 'One'), createTestItem('b', 'Two')]

    // 2-column layout
    const twoCol = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={120}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    // 1-column layout
    const oneCol = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={80}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    expect(twoCol).toContain('One')
    expect(twoCol).toContain('Two')
    expect(oneCol).toContain('One')
    expect(oneCol).toContain('Two')
  })

  test('transition works with 3 items', () => {
    const items = [
      createTestItem('a', 'Red'),
      createTestItem('b', 'Green'),
      createTestItem('c', 'Blue'),
    ]

    const twoCol = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={120}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    const oneCol = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={80}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    expect(twoCol).toContain('Red')
    expect(twoCol).toContain('Green')
    expect(twoCol).toContain('Blue')
    expect(oneCol).toContain('Red')
    expect(oneCol).toContain('Green')
    expect(oneCol).toContain('Blue')
  })

  test('transition works with 4 items', () => {
    const items = [
      createTestItem('a', 'North'),
      createTestItem('b', 'South'),
      createTestItem('c', 'East'),
      createTestItem('d', 'West'),
    ]

    const twoCol = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={120}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    const oneCol = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={80}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    expect(twoCol).toContain('North')
    expect(twoCol).toContain('South')
    expect(twoCol).toContain('East')
    expect(twoCol).toContain('West')
    expect(oneCol).toContain('North')
    expect(oneCol).toContain('South')
    expect(oneCol).toContain('East')
    expect(oneCol).toContain('West')
  })

  test('columnWidth is passed correctly in both layouts', () => {
    const items = [createTestItem('a', 'A'), createTestItem('b', 'B')]

    const twoColWidths: number[] = []
    const oneColWidths: number[] = []

    renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={120}
        getItemKey={defaultGetItemKey}
        renderItem={(item, _idx, width) => {
          twoColWidths.push(width)
          return <text>{item.name}</text>
        }}
      />,
    )

    renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={80}
        getItemKey={defaultGetItemKey}
        renderItem={(item, _idx, width) => {
          oneColWidths.push(width)
          return <text>{item.name}</text>
        }}
      />,
    )

    // 2-column: (120 - 1 gap) / 2 = 59.5 -> 59
    expect(twoColWidths[0]).toBe(59)
    expect(twoColWidths[1]).toBe(59)

    // 1-column: full width
    expect(oneColWidths[0]).toBe(80)
    expect(oneColWidths[1]).toBe(80)
  })

  test('unified structure handles rapid width changes', () => {
    const items = [
      createTestItem('a', 'Item1'),
      createTestItem('b', 'Item2'),
      createTestItem('c', 'Item3'),
    ]

    // Simulate rapid resize: 2-col -> 1-col -> 2-col -> 1-col
    const widths = [120, 80, 120, 80]

    for (const width of widths) {
      const markup = renderToStaticMarkup(
        <GridLayout
          items={items}
          availableWidth={width}
          getItemKey={defaultGetItemKey}
          renderItem={defaultRenderItem}
        />,
      )

      // All items should always be present regardless of width
      expect(markup).toContain('Item1')
      expect(markup).toContain('Item2')
      expect(markup).toContain('Item3')
    }
  })
})

// GridLayout — column layout based on available width, including narrow
// terminal behavior and threshold boundaries.
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

describe('GridLayout - column layout based on width', () => {
  test('narrow width (< 100) uses single column', () => {
    const items = [
      createTestItem('a', 'Alpha'),
      createTestItem('b', 'Beta'),
      createTestItem('c', 'Gamma'),
    ]

    const markup = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={80}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    expect(markup).toContain('Alpha')
    expect(markup).toContain('Beta')
    expect(markup).toContain('Gamma')
  })

  test('medium width (100-149) uses up to 2 columns', () => {
    const items = [createTestItem('a', 'Alpha'), createTestItem('b', 'Beta')]

    const markup = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={120}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    expect(markup).toContain('Alpha')
    expect(markup).toContain('Beta')
  })

  test('large width (150-199) uses up to 3 columns', () => {
    const items = [
      createTestItem('a', 'Alpha'),
      createTestItem('b', 'Beta'),
      createTestItem('c', 'Gamma'),
    ]

    const markup = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={180}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    expect(markup).toContain('Alpha')
    expect(markup).toContain('Beta')
    expect(markup).toContain('Gamma')
  })

  test('extra large width (>= 200) uses up to 4 columns', () => {
    const items = [
      createTestItem('a', 'Alpha'),
      createTestItem('b', 'Beta'),
      createTestItem('c', 'Gamma'),
      createTestItem('d', 'Delta'),
    ]

    const markup = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={250}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    expect(markup).toContain('Alpha')
    expect(markup).toContain('Beta')
    expect(markup).toContain('Gamma')
    expect(markup).toContain('Delta')
  })
})

describe('GridLayout - narrow terminal rendering', () => {
  test('renders all items with very narrow width (15 chars)', () => {
    const items = [
      createTestItem('a', 'Item A'),
      createTestItem('b', 'Item B'),
      createTestItem('c', 'Item C'),
    ]

    const markup = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={15}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    expect(markup).toContain('Item A')
    expect(markup).toContain('Item B')
    expect(markup).toContain('Item C')
  })

  test('renders all items with narrow width (20 chars)', () => {
    const items = [
      createTestItem('a', 'First'),
      createTestItem('b', 'Second'),
      createTestItem('c', 'Third'),
      createTestItem('d', 'Fourth'),
    ]

    const markup = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={20}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    expect(markup).toContain('First')
    expect(markup).toContain('Second')
    expect(markup).toContain('Third')
    expect(markup).toContain('Fourth')
  })

  test('uses single column for narrow width with multiple items', () => {
    const items = [
      createTestItem('a', 'Alpha'),
      createTestItem('b', 'Beta'),
      createTestItem('c', 'Gamma'),
    ]
    const widths: number[] = []

    renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={18}
        getItemKey={defaultGetItemKey}
        renderItem={(item, _idx, width) => {
          widths.push(width)
          return <text>{item.name}</text>
        }}
      />,
    )

    // All items should receive the full availableWidth (single column)
    expect(widths).toEqual([18, 18, 18])
  })

  test('renders items in correct order with narrow width', () => {
    const items = [
      createTestItem('a', 'One'),
      createTestItem('b', 'Two'),
      createTestItem('c', 'Three'),
      createTestItem('d', 'Four'),
    ]

    const markup = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={15}
        getItemKey={defaultGetItemKey}
        renderItem={defaultRenderItem}
      />,
    )

    const onePos = markup.indexOf('One')
    const twoPos = markup.indexOf('Two')
    const threePos = markup.indexOf('Three')
    const fourPos = markup.indexOf('Four')

    expect(onePos).toBeLessThan(twoPos)
    expect(twoPos).toBeLessThan(threePos)
    expect(threePos).toBeLessThan(fourPos)
  })

  test('handles boundary width (21 chars) - still single column due to threshold', () => {
    const items = [createTestItem('a', 'A'), createTestItem('b', 'B')]
    const widths: number[] = []

    renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={21}
        getItemKey={defaultGetItemKey}
        renderItem={(item, _idx, width) => {
          widths.push(width)
          return <text>{item.name}</text>
        }}
      />,
    )

    // 21 passes the minWidthForTwoColumns check (21 >= 21), but
    // maxColumns is still 1 because 21 < WIDTH_MD_THRESHOLD (100)
    // So it uses single column with full availableWidth
    expect(widths[0]).toBe(21)
    expect(widths[1]).toBe(21)
  })

  test('forces single column when width is just below threshold (20 chars)', () => {
    const items = [createTestItem('a', 'A'), createTestItem('b', 'B')]
    const widths: number[] = []

    renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={20}
        getItemKey={defaultGetItemKey}
        renderItem={(item, _idx, width) => {
          widths.push(width)
          return <text>{item.name}</text>
        }}
      />,
    )

    // 20 is below minWidthForTwoColumns (21), so single column
    // columnWidth = availableWidth = 20
    expect(widths[0]).toBe(20)
    expect(widths[1]).toBe(20)
  })
})

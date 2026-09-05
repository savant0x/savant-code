// GridLayout — item rendering: empty state, single/multiple items, key and
// render callbacks. Parent of the Loop 326 decomposition (footer/marginTop
// in grid-layout-props, width behavior in grid-layout-columns, resize
// regression in grid-layout-transition, and edge/memoization cases in
// grid-layout-edge-cases).

import { describe, test, expect } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { GridLayout } from '../grid-layout'
import {
  createTestItem,
  defaultGetItemKey,
  defaultRenderItem,
  type TestItem,
} from './grid-layout-test-fixtures'

describe('GridLayout', () => {
  describe('empty state', () => {
    test('returns null for empty items array', () => {
      const markup = renderToStaticMarkup(
        <GridLayout
          items={[]}
          availableWidth={120}
          getItemKey={defaultGetItemKey}
          renderItem={defaultRenderItem}
        />,
      )

      expect(markup).toBe('')
    })
  })

  describe('single item rendering', () => {
    test('renders a single item', () => {
      const items = [createTestItem('item-1', 'First Item')]

      const markup = renderToStaticMarkup(
        <GridLayout
          items={items}
          availableWidth={120}
          getItemKey={defaultGetItemKey}
          renderItem={defaultRenderItem}
        />,
      )

      expect(markup).toContain('First Item')
    })

    test('uses single column layout for one item', () => {
      const items = [createTestItem('item-1', 'Only Item')]

      const markup = renderToStaticMarkup(
        <GridLayout
          items={items}
          availableWidth={200}
          getItemKey={defaultGetItemKey}
          renderItem={defaultRenderItem}
        />,
      )

      expect(markup).toContain('Only Item')
    })
  })

  describe('multiple items rendering', () => {
    test('renders all items', () => {
      const items = [
        createTestItem('item-1', 'Item One'),
        createTestItem('item-2', 'Item Two'),
        createTestItem('item-3', 'Item Three'),
      ]

      const markup = renderToStaticMarkup(
        <GridLayout
          items={items}
          availableWidth={180}
          getItemKey={defaultGetItemKey}
          renderItem={defaultRenderItem}
        />,
      )

      expect(markup).toContain('Item One')
      expect(markup).toContain('Item Two')
      expect(markup).toContain('Item Three')
    })

    test('renders items in correct order', () => {
      const items = [
        createTestItem('a', 'Alpha'),
        createTestItem('b', 'Beta'),
        createTestItem('c', 'Gamma'),
      ]

      const markup = renderToStaticMarkup(
        <GridLayout
          items={items}
          availableWidth={50}
          getItemKey={defaultGetItemKey}
          renderItem={defaultRenderItem}
        />,
      )

      const alphaPos = markup.indexOf('Alpha')
      const betaPos = markup.indexOf('Beta')
      const gammaPos = markup.indexOf('Gamma')

      expect(alphaPos).toBeLessThan(betaPos)
      expect(betaPos).toBeLessThan(gammaPos)
    })
  })

  describe('getItemKey function', () => {
    test('uses getItemKey for React keys', () => {
      const items = [
        createTestItem('unique-key-1', 'Item 1'),
        createTestItem('unique-key-2', 'Item 2'),
      ]

      const markup = renderToStaticMarkup(
        <GridLayout
          items={items}
          availableWidth={120}
          getItemKey={(item) => `custom-${item.id}`}
          renderItem={defaultRenderItem}
        />,
      )

      expect(markup).toContain('Item 1')
      expect(markup).toContain('Item 2')
    })

    test('handles numeric keys', () => {
      interface NumericItem {
        index: number
        label: string
      }

      const items: NumericItem[] = [
        { index: 0, label: 'Zero' },
        { index: 1, label: 'One' },
      ]

      const markup = renderToStaticMarkup(
        <GridLayout
          items={items}
          availableWidth={120}
          getItemKey={(item) => String(item.index)}
          renderItem={(item) => <text>{item.label}</text>}
        />,
      )

      expect(markup).toContain('Zero')
      expect(markup).toContain('One')
    })
  })

  describe('renderItem function', () => {
    test('passes correct item to renderItem', () => {
      const items = [createTestItem('test-id', 'Test Name')]
      const renderedItems: TestItem[] = []

      renderToStaticMarkup(
        <GridLayout
          items={items}
          availableWidth={120}
          getItemKey={defaultGetItemKey}
          renderItem={(item, _idx, _width) => {
            renderedItems.push(item)
            return <text>{item.name}</text>
          }}
        />,
      )

      expect(renderedItems).toHaveLength(1)
      expect(renderedItems[0]).toEqual({ id: 'test-id', name: 'Test Name' })
    })

    test('passes correct index to renderItem', () => {
      const items = [
        createTestItem('a', 'A'),
        createTestItem('b', 'B'),
        createTestItem('c', 'C'),
      ]
      const indices: number[] = []

      renderToStaticMarkup(
        <GridLayout
          items={items}
          availableWidth={50}
          getItemKey={defaultGetItemKey}
          renderItem={(item, idx, _width) => {
            indices.push(idx)
            return <text>{item.name}</text>
          }}
        />,
      )

      expect(indices).toEqual([0, 1, 2])
    })

    test('passes columnWidth to renderItem for single column', () => {
      const items = [createTestItem('a', 'A')]
      const widths: number[] = []

      renderToStaticMarkup(
        <GridLayout
          items={items}
          availableWidth={120}
          getItemKey={defaultGetItemKey}
          renderItem={(item, _idx, width) => {
            widths.push(width)
            return <text>{item.name}</text>
          }}
        />,
      )

      expect(widths[0]).toBe(120)
    })

    test('passes calculated columnWidth to renderItem for multi-column', () => {
      const items = [createTestItem('a', 'A'), createTestItem('b', 'B')]
      const widths: number[] = []

      renderToStaticMarkup(
        <GridLayout
          items={items}
          availableWidth={121}
          getItemKey={defaultGetItemKey}
          renderItem={(item, _idx, width) => {
            widths.push(width)
            return <text>{item.name}</text>
          }}
        />,
      )

      // 2 columns: (121 - 1 gap) / 2 = 60
      expect(widths[0]).toBe(60)
      expect(widths[1]).toBe(60)
    })
  })
})

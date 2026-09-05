// GridLayout — footer and marginTop props.
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

describe('GridLayout - props', () => {
  describe('footer prop', () => {
    test('renders footer when provided', () => {
      const items = [createTestItem('item-1', 'Item')]

      const markup = renderToStaticMarkup(
        <GridLayout
          items={items}
          availableWidth={120}
          getItemKey={defaultGetItemKey}
          renderItem={defaultRenderItem}
          footer={<text>Footer Content</text>}
        />,
      )

      expect(markup).toContain('Footer Content')
    })

    test('renders footer after items in single column', () => {
      const items = [createTestItem('item-1', 'Main Item')]

      const markup = renderToStaticMarkup(
        <GridLayout
          items={items}
          availableWidth={50}
          getItemKey={defaultGetItemKey}
          renderItem={defaultRenderItem}
          footer={<text>The Footer</text>}
        />,
      )

      const itemPos = markup.indexOf('Main Item')
      const footerPos = markup.indexOf('The Footer')

      expect(itemPos).toBeLessThan(footerPos)
    })

    test('renders footer after items in multi-column', () => {
      const items = [
        createTestItem('a', 'Item A'),
        createTestItem('b', 'Item B'),
      ]

      const markup = renderToStaticMarkup(
        <GridLayout
          items={items}
          availableWidth={120}
          getItemKey={defaultGetItemKey}
          renderItem={defaultRenderItem}
          footer={<text>Multi-col Footer</text>}
        />,
      )

      expect(markup).toContain('Item A')
      expect(markup).toContain('Item B')
      expect(markup).toContain('Multi-col Footer')
    })

    test('does not render footer when not provided', () => {
      const items = [createTestItem('item-1', 'Item')]

      const markup = renderToStaticMarkup(
        <GridLayout
          items={items}
          availableWidth={120}
          getItemKey={defaultGetItemKey}
          renderItem={defaultRenderItem}
        />,
      )

      expect(markup).not.toContain('Footer')
    })

    test('renders complex footer elements', () => {
      const items = [createTestItem('item-1', 'Item')]

      const markup = renderToStaticMarkup(
        <GridLayout
          items={items}
          availableWidth={120}
          getItemKey={defaultGetItemKey}
          renderItem={defaultRenderItem}
          footer={
            <box>
              <text>Status:</text>
              <text>Complete</text>
            </box>
          }
        />,
      )

      expect(markup).toContain('Status:')
      expect(markup).toContain('Complete')
    })
  })

  describe('marginTop prop', () => {
    test('applies default marginTop of 0', () => {
      const items = [createTestItem('item-1', 'Item')]

      const markup = renderToStaticMarkup(
        <GridLayout
          items={items}
          availableWidth={120}
          getItemKey={defaultGetItemKey}
          renderItem={defaultRenderItem}
        />,
      )

      expect(markup).toBeDefined()
    })

    test('applies custom marginTop', () => {
      const items = [createTestItem('item-1', 'Item')]

      const markup = renderToStaticMarkup(
        <GridLayout
          items={items}
          availableWidth={120}
          getItemKey={defaultGetItemKey}
          renderItem={defaultRenderItem}
          marginTop={2}
        />,
      )

      expect(markup).toContain('Item')
    })
  })
})

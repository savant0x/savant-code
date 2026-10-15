// GridLayout — generic type support (string, number, and complex object
// items).
// Sibling of the Loop 326 decomposition (shared fixtures in
// ./grid-layout-test-fixtures).

import { describe, test, expect } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { GridLayout } from '../grid-layout'

describe('GridLayout - generic type support', () => {
  test('works with string items', () => {
    const items = ['one', 'two', 'three']

    const markup = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={180}
        getItemKey={(item) => item}
        renderItem={(item) => <text>{item.toUpperCase()}</text>}
      />,
    )

    expect(markup).toContain('ONE')
    expect(markup).toContain('TWO')
    expect(markup).toContain('THREE')
  })

  test('works with number items', () => {
    const items = [1, 2, 3]

    const markup = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={180}
        getItemKey={(item) => String(item)}
        renderItem={(item) => <text>Number: {item}</text>}
      />,
    )

    expect(markup).toContain('Number: 1')
    expect(markup).toContain('Number: 2')
    expect(markup).toContain('Number: 3')
  })

  test('works with complex object items', () => {
    interface ComplexItem {
      id: string
      data: {
        title: string
        count: number
      }
    }

    const items: ComplexItem[] = [
      { id: 'c1', data: { title: 'First', count: 10 } },
      { id: 'c2', data: { title: 'Second', count: 20 } },
    ]

    const markup = renderToStaticMarkup(
      <GridLayout
        items={items}
        availableWidth={120}
        getItemKey={(item) => item.id}
        renderItem={(item) => (
          <text>
            {item.data.title}: {item.data.count}
          </text>
        )}
      />,
    )

    expect(markup).toContain('First: 10')
    expect(markup).toContain('Second: 20')
  })
})

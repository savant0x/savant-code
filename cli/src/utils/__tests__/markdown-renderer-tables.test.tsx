// Markdown renderer test family — GFM table rendering. Sibling of the
// Loop-336 decomposition (shared helpers in ./markdown-renderer-test-harness).

import { describe, expect, test } from 'bun:test'
import React from 'react'

import { renderMarkdown } from '../markdown-renderer'
import { flattenChildren, flattenNodes } from './markdown-renderer-test-harness'

import type { El} from './markdown-renderer-test-harness';

describe('markdown renderer', () => {
  test('renders tables with GFM', () => {
    const markdown = `| Name | Age |
| ---- | --- |
| John | 30  |
| Jane | 25  |`
    const output = renderMarkdown(markdown)
    const nodes = flattenNodes(output)

    // Check that table structure is rendered with box-drawing characters
    const textContent = nodes
      .map((node) => {
        if (typeof node === 'string') return node
        if (React.isValidElement(node)) {
          return flattenChildren((node as El).props.children).join('')
        }
        return ''
      })
      .join('')

    expect(textContent).toContain('Name')
    expect(textContent).toContain('Age')
    expect(textContent).toContain('John')
    expect(textContent).toContain('Jane')
    expect(textContent).toContain('30')
    expect(textContent).toContain('25')
    // Table uses box-drawing characters for borders
    expect(textContent).toContain('│')
    expect(textContent).toContain('─')
  })
})

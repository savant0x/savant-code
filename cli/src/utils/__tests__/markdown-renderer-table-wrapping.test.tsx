// Markdown renderer test family — table column wrapping, width budgets, and
// Unicode grapheme handling. Sibling of the Loop-336 decomposition (shared
// helpers in ./markdown-renderer-test-harness).

import { describe, expect, test } from 'bun:test'
import React from 'react'
import stringWidth from 'string-width'

import { renderMarkdown } from '../markdown-renderer'
import { flattenChildren, flattenNodes } from './markdown-renderer-test-harness'

import type { El } from './markdown-renderer-test-harness'

describe('markdown renderer', () => {
  test('wraps table columns when content exceeds available width', () => {
    // Table with very long content that should be wrapped
    const markdown = `| ID | This is a very long column header that should wrap |
| -- | -------------------------------------------------- |
| 1  | This cell has extremely long content that definitely exceeds the width |`

    // Use a narrow codeBlockWidth to force wrapping
    const output = renderMarkdown(markdown, { codeBlockWidth: 50 })
    const nodes = flattenNodes(output)

    const textContent = nodes
      .map((node) => {
        if (typeof node === 'string') return node
        if (React.isValidElement(node)) {
          return flattenChildren((node as El).props.children).join('')
        }
        return ''
      })
      .join('')

    // Should NOT contain ellipsis - content wraps instead of truncating
    expect(textContent).not.toContain('…')
    // The short column content should be present
    expect(textContent).toContain('ID')
    expect(textContent).toContain('1')
    // Box-drawing characters should still be present
    expect(textContent).toContain('│')
    expect(textContent).toContain('─')
    // The full content should be present across wrapped lines
    expect(textContent).toContain('long')
    expect(textContent).toContain('header')
    expect(textContent).toContain('wrap')
    expect(textContent).toContain('extremely')
    expect(textContent).toContain('exceeds')
  })

  test('does not wrap table columns when content fits available width', () => {
    const markdown = `| Name | Age |
| ---- | --- |
| John | 30  |`

    // Use a wide codeBlockWidth so no wrapping is needed
    const output = renderMarkdown(markdown, { codeBlockWidth: 80 })
    const nodes = flattenNodes(output)

    const textContent = nodes
      .map((node) => {
        if (typeof node === 'string') return node
        if (React.isValidElement(node)) {
          return flattenChildren((node as El).props.children).join('')
        }
        return ''
      })
      .join('')

    // All content should be present in full
    expect(textContent).toContain('Name')
    expect(textContent).toContain('Age')
    expect(textContent).toContain('John')
    expect(textContent).toContain('30')
  })

  test('keeps compact tables within very narrow width budgets', () => {
    const markdown = `| Name | Value |
| ---- | ----- |
| wide | text |`

    for (const width of [1, 2, 3, 4, 5, 8, 24, 40, 58, 80, 120]) {
      const output = renderMarkdown(markdown, { codeBlockWidth: width })
      const textContent = flattenNodes(output)
        .map((node) => {
          if (typeof node === 'string') return node
          if (React.isValidElement(node)) {
            return flattenChildren((node as El).props.children).join('')
          }
          return ''
        })
        .join('')

      const rows = textContent.split('\n').filter((row) => row.length > 0)
      expect(rows.length).toBeGreaterThan(0)
      rows.forEach((row) => expect(stringWidth(row)).toBeLessThanOrEqual(width))
    }
  })

  test('keeps wide Unicode graphemes within a one-column budget', () => {
    const markdown = `| 名称 | 值 |
| ---- | --- |
| 東京 | 好 |`

    const output = renderMarkdown(markdown, { codeBlockWidth: 1 })
    const textContent = flattenNodes(output)
      .map((node) => {
        if (typeof node === 'string') return node
        if (React.isValidElement(node)) {
          return flattenChildren((node as El).props.children).join('')
        }
        return ''
      })
      .join('')

    textContent
      .split('\n')
      .filter(Boolean)
      .forEach((row) => expect(stringWidth(row)).toBeLessThanOrEqual(1))
    expect(textContent).toContain('·')
  })

  test('wraps and shows full content when table is too wide', () => {
    // Three columns of roughly equal width
    const markdown = `| Column One | Column Two | Column Three |
| ---------- | ---------- | ------------ |
| Value1     | Value2     | Value3       |`

    // Very narrow width to force significant wrapping
    const output = renderMarkdown(markdown, { codeBlockWidth: 30 })
    const nodes = flattenNodes(output)

    const textContent = nodes
      .map((node) => {
        if (typeof node === 'string') return node
        if (React.isValidElement(node)) {
          return flattenChildren((node as El).props.children).join('')
        }
        return ''
      })
      .join('')

    // Table structure should still be present
    expect(textContent).toContain('│')
    expect(textContent).toContain('┌')
    expect(textContent).toContain('└')
    // Full content should still be visible (wrapped, not truncated)
    expect(textContent).not.toContain('…')
    // All values should be present
    expect(textContent).toContain('Value1')
    expect(textContent).toContain('Value2')
    expect(textContent).toContain('Value3')
  })
})

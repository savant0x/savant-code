// Markdown renderer test family — quotes and special characters inside code
// fences and inline code. Sibling of the Loop-336 decomposition (shared
// helpers in ./markdown-renderer-test-harness).

import { describe, expect, test } from 'bun:test'
import React from 'react'

import { renderMarkdown } from '../markdown-renderer'
import { flattenChildren, flattenNodes } from './markdown-renderer-test-harness'

import type { El } from './markdown-renderer-test-harness'

describe('markdown renderer', () => {
  test('renders code fence followed by text with quotes correctly', () => {
    const markdown = `\`\`\`bash
# Start using it
savant-code "add a new feature to handle user authentication"
\`\`\``
    const output = renderMarkdown(markdown)
    const nodes = flattenNodes(output)

    // Get the text content from all nodes
    const textContent = nodes
      .map((node) => {
        if (typeof node === 'string') return node
        if (React.isValidElement(node)) {
          return flattenChildren((node as El).props.children).join('')
        }
        return ''
      })
      .join('')

    // Should contain the complete command text
    expect(textContent).toContain('# Start using it')
    expect(textContent).toContain(
      'savant-code "add a new feature to handle user authentication"',
    )

    // Should NOT have quotes concatenated with backticks
    expect(textContent).not.toContain('it"')
    expect(textContent).not.toContain('```"')
  })

  test('renders inline code followed by quotes correctly', () => {
    const markdown = 'Use `savant-code "fix bug"` to fix bugs.'
    const output = renderMarkdown(markdown)
    const nodes = flattenNodes(output)

    expect(nodes[0]).toBe('Use ')

    const inlineCode = nodes[1] as El
    expect(inlineCode.props.fg).toBe('green')
    const inlineContent = flattenChildren(inlineCode.props.children).join('')
    expect(inlineContent).toContain('savant-code "fix bug"')

    expect(nodes[2]).toBe(' to fix bugs.')

    // Verify quotes are inside the inline code, not concatenated after
    expect(inlineContent).toMatch(/savant-code\s+"fix bug"/)
  })

  test('renders multiple code blocks with text between them', () => {
    const markdown = `First block:

\`\`\`js
console.log("hello")
\`\`\`

Middle text with "quotes"

\`\`\`js
console.log("world")
\`\`\``
    const output = renderMarkdown(markdown)
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

    // All content should be present
    expect(textContent).toContain('First block:')
    expect(textContent).toContain('console.log("hello")')
    expect(textContent).toContain('Middle text with "quotes"')
    expect(textContent).toContain('console.log("world")')

    // Verify no quote concatenation issues
    expect(textContent).not.toContain('```"')
    expect(textContent).not.toContain('"```')
  })

  test('renders code fence with command and quotes on same line', () => {
    const markdown = `\`\`\`bash
savant-code "implement feature" --verbose
\`\`\``
    const output = renderMarkdown(markdown)
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

    // Should preserve the complete command with quotes
    expect(textContent).toContain('savant-code "implement feature" --verbose')
    expect(textContent).not.toContain('```"')
  })

  test('renders inline code with special characters correctly', () => {
    const markdown = 'Run `git commit -m "fix: bug"` to commit.'
    const output = renderMarkdown(markdown)
    const nodes = flattenNodes(output)

    const inlineCode = nodes[1] as El
    const inlineContent = flattenChildren(inlineCode.props.children).join('')

    // Should preserve quotes and special characters within inline code
    expect(inlineContent).toContain('git commit -m "fix: bug"')
    expect(nodes[2]).toBe(' to commit.')
  })
})

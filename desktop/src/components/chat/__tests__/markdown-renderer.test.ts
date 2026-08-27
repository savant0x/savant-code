import { describe, expect, test } from 'bun:test'

import { renderInline } from '../markdown-inline'
import { parseMarkdown } from '../MarkdownBlock'

import type { ReactNode } from 'react'

// FID-2026-0820-010 Loop 3 — security-adjacent renderer coverage (Verifier
// condition C3): the scheme allowlist and block parser get dedicated unit
// tests because model output is untrusted content.

type ElementLike = {
  type: string | symbol
  props?: { children?: unknown; href?: unknown; rel?: unknown }
}

function flatten(nodes: ReactNode[]): string {
  return nodes
    .map((node) => {
      if (typeof node === 'string') return node
      if (Array.isArray(node)) return flatten(node)
      const element = node as ElementLike
      if (
        typeof element === 'object' &&
        element !== null &&
        typeof element.type === 'string' &&
        element.props !== undefined
      ) {
        const children = element.props.children
        if (typeof children === 'string') return children
        if (Array.isArray(children)) return flatten(children as ReactNode[])
      }
      return ''
    })
    .join('')
}

function findAnchor(nodes: ReactNode[]): ElementLike | null {
  for (const node of nodes) {
    if (Array.isArray(node)) {
      const nested = findAnchor(node)
      if (nested !== null) return nested
      continue
    }
    const element = node as ElementLike
    if (
      typeof element === 'object' &&
      element !== null &&
      element.type === 'a'
    ) {
      return element
    }
  }
  return null
}

describe('renderInline link safety', () => {
  test('accepts https links with noopener noreferrer', () => {
    const anchor = findAnchor(
      renderInline('[docs](https://example.com/x)', 't'),
    )
    expect(anchor).not.toBeNull()
    if (anchor?.props === undefined) throw new Error('anchor props missing')
    expect(anchor.props.href).toBe('https://example.com/x')
    expect(anchor.props.rel).toBe('noopener noreferrer')
    expect(flatten(renderInline('[docs](https://example.com/x)', 't'))).toBe(
      'docs',
    )
  })

  test('rejects javascript: hrefs to inert literal text', () => {
    const source = '[click](javascript:alert(1))'
    const nodes = renderInline(source, 't')
    expect(findAnchor(nodes)).toBeNull()
    // Fail-safe inert: the raw syntax survives as plain text, nothing executes.
    expect(flatten(nodes)).toBe(source)
  })

  test('rejects data: hrefs to inert literal text', () => {
    const source = '[payload](data:text/html;base64,PHNjcmlwdD4=)'
    const nodes = renderInline(source, 't')
    expect(findAnchor(nodes)).toBeNull()
    expect(flatten(nodes)).toBe(source)
  })

  test('relative hrefs are unparseable without a base and fall through inert', () => {
    const source = '[rel](/local/path)'
    const nodes = renderInline(source, 't')
    expect(findAnchor(nodes)).toBeNull()
    expect(flatten(nodes)).toBe(source)
  })
})

describe('renderInline spans', () => {
  test('emits strong/em/code elements with recursive labels', () => {
    const nodes = renderInline('a **b** c *d* e `f`', 't')
    const types = nodes.flatMap((node): string[] => {
      if (Array.isArray(node)) return []
      const element = node as ElementLike
      if (
        typeof element === 'object' &&
        element !== null &&
        typeof element.type === 'string'
      ) {
        return [element.type]
      }
      return []
    })
    expect(types).toContain('strong')
    expect(types).toContain('em')
    expect(types).toContain('code')
    expect(flatten([...nodes])).toContain('b')
  })
})

describe('parseMarkdown blocks', () => {
  test('extracts fenced code verbatim and stops at the closing fence', () => {
    const blocks = parseMarkdown('before\n```ts\nconst a = 1\n```\nafter')
    expect(blocks.map((block) => block.kind)).toEqual(['para', 'code', 'para'])
    const code = blocks[1]
    if (code.kind !== 'code') throw new Error(`expected code, got ${code.kind}`)
    expect(code.text).toBe('const a = 1')
  })

  test('an unterminated fence consumes to EOF', () => {
    const blocks = parseMarkdown('```js\nlet x = 2')
    expect(blocks).toHaveLength(1)
    const code = blocks[0]
    if (code.kind !== 'code') throw new Error(`expected code, got ${code.kind}`)
    expect(code.text).toBe('let x = 2')
  })

  test('captures ordered list items', () => {
    const blocks = parseMarkdown('1. first\n2. second\n3. third')
    expect(blocks).toHaveLength(1)
    const list = blocks[0]
    if (list.kind !== 'list') throw new Error(`expected list, got ${list.kind}`)
    expect(list.ordered).toBe(true)
    expect(list.items).toEqual(['first', 'second', 'third'])
  })

  test('headings map to levels 1-6', () => {
    const blocks = parseMarkdown('# one\n#### four')
    expect(blocks[0]).toMatchObject({ kind: 'heading', level: 1 })
    expect(blocks[1]).toMatchObject({ kind: 'heading', level: 4 })
  })

  test('renders pipe tables with column alignment', () => {
    const blocks = parseMarkdown(
      '| tool | status |\n|:-----|-------:|\n| grep | ok |\n| ls | fail |',
    )
    expect(blocks).toHaveLength(1)
    const table = blocks[0]
    if (table.kind !== 'table')
      throw new Error(`expected table, got ${table.kind}`)
    expect(table.header).toEqual(['tool', 'status'])
    expect(table.aligns).toEqual(['left', 'right'])
    expect(table.rows).toEqual([
      ['grep', 'ok'],
      ['ls', 'fail'],
    ])
  })

  test('a pipe row without a delimiter row stays an inert paragraph', () => {
    const blocks = parseMarkdown('| just | pipes |')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ kind: 'para' })
  })

  test('horizontal rules parse as hr blocks', () => {
    const blocks = parseMarkdown('above\n\n---\n\nbelow\n***')
    expect(blocks.map((block) => block.kind)).toEqual([
      'para',
      'hr',
      'para',
      'hr',
    ])
  })
})

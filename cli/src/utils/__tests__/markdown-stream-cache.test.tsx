/**
 * FID-2026-1030-006 — incremental streaming markdown render cache.
 *
 * The contract under test has three halves:
 *
 *   1. Every chunk split point is structurally identical to one full render
 *      (a wrong split is a transcript defect, not a perf regression).
 *   2. Concatenated chunks share one unique key space.
 *   3. A flush's render work is proportional to the delta, not to the
 *      document — the regression gate that keeps full re-renders out.
 */

import { describe, expect, test } from 'bun:test'
import React from 'react'

import {
  renderMarkdown,
  renderMarkdownWithMeta,
} from '../markdown-renderer'
import {
  MarkdownStreamCache,
  STREAM_RELAX_AFTER,
  countFenceLines,
  findSafeBoundary,
} from '../markdown-stream-cache'

import type { RenderedMarkdownChunk } from '../markdown-renderer'

const OPTIONS = { codeBlockWidth: 80 }

const CORPUS: readonly string[] = [
  'First paragraph with **bold** text.\n\nSecond paragraph with `code`.',
  '# Heading\n\nA paragraph.\n\n## Subheading\n\n- alpha\n- beta\n\nDone.',
  'Intro\n\n```ts\nconst value = 42\nconsole.log(value)\n```\n\nAfter the fence.',
  'Intro\n\n```ts\nconst value = 42',
  'Text before.\n\n> quoted line\n> second line\n\nText after.',
  'Loose list:\n\n- first item\n\n- second item\n\nTail paragraph.',
  'Table follows.\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nTail.',
  'Setext heading\n===\n\nBody text.',
  '1. one\n2. two\n\n3. three\n\nEnd.',
  'Plain prose without any blank line at all',
  '',
]

const EMPTY = Symbol('empty')

type Projected = string | symbol | { [key: string]: unknown }

const projectProps = (
  props: Record<string, unknown>,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(props)) {
    if (name === 'children') continue
    if (typeof value === 'function') continue
    if (name === 'syntaxStyle') continue
    result[name] = value
  }
  return result
}

const project = (node: unknown): Projected => {
  if (node === null || node === undefined || node === false) return EMPTY
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) {
    const children = node.map(project).filter((child) => child !== EMPTY)
    return { children }
  }
  if (React.isValidElement(node)) {
    const props = node.props as Record<string, unknown>
    return {
      type:
        typeof node.type === 'string'
          ? node.type
          : ((node.type as { displayName?: string; name?: string })
              .displayName ?? (node.type as { name?: string }).name ?? 'component'),
      props: projectProps(props),
      children: project(props.children),
    }
  }
  return String(node)
}

const renderClean = (content: string): Projected =>
  project(renderMarkdown(content, OPTIONS))

const topLevelKeys = (node: unknown): string[] => {
  const keys: string[] = []
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (!React.isValidElement(value)) return
    if (value.type === React.Fragment && value.key == null) {
      visit((value.props as { children?: unknown }).children)
      return
    }
    if (value.key != null) keys.push(String(value.key))
  }
  visit(node)
  return keys
}

describe('findSafeBoundary', () => {
  test('splits after a blank line between paragraphs', () => {
    const content = 'a\n\nb'
    expect(findSafeBoundary(content, 0, 0)).toEqual({
      index: 3,
      fenceCount: 0,
    })
  })

  test('refuses a blank line inside a fenced code block', () => {
    expect(findSafeBoundary('```\na\n\nb', 0, 0).index).toBe(-1)
  })

  test('refuses blank lines that continue a list, blockquote, table or setext', () => {
    expect(findSafeBoundary('- a\n\n- b', 0, 0).index).toBe(-1)
    expect(findSafeBoundary('> a\n\n> b', 0, 0).index).toBe(-1)
    expect(findSafeBoundary('| a |\n| --- |\n| 1 |\n\n| b |', 0, 0).index).toBe(
      -1,
    )
    expect(findSafeBoundary('a\n\n===', 0, 0).index).toBe(-1)
    expect(findSafeBoundary('a\n\n    b', 0, 0).index).toBe(-1)
  })

  test('never splits a document with no newline, even past the relax threshold', () => {
    const content = 'x'.repeat(STREAM_RELAX_AFTER + 2000)
    expect(findSafeBoundary(content, 0, 0).index).toBe(-1)
  })

  test('relaxes to the last blank line once the tail is long', () => {
    const content = `${'- item\n'.repeat(1500)}\ntail`
    const boundary = findSafeBoundary(content, 0, 0)
    expect(boundary.index).toBeGreaterThan(0)
    expect(content.slice(boundary.index)).toBe('tail')
  })

  test('counts fence delimiters for parity', () => {
    expect(countFenceLines('a\n```\nb\n```\nc')).toBe(2)
  })
})

describe('MarkdownStreamCache', () => {
  for (const fixture of CORPUS.filter((entry) => entry.length > 0)) {
    test(`streams a fixture in increments identically to one full render: ${fixture.slice(0, 24)}`, () => {
      const cache = new MarkdownStreamCache()
      const step = Math.max(1, Math.floor(fixture.length / 7))
      let output: unknown
      for (let end = step; end < fixture.length; end += step) {
        output = cache.renderContent(fixture.slice(0, end), OPTIONS)
        expect(output).toBeDefined()
      }
      output = cache.renderContent(fixture, OPTIONS)

      expect(project(output)).toEqual(renderClean(fixture))
    })
  }

  test('keeps top-level keys unique and ordered across boundary advances', () => {
    const cache = new MarkdownStreamCache()
    const content =
      '# Title\n\nFirst paragraph.\n\nSecond paragraph.\n\n```ts\nconst a = 1\n```\n\nTail paragraph.'
    cache.renderContent('# Title\n\nFirst paragraph.', OPTIONS)
    cache.renderContent(
      '# Title\n\nFirst paragraph.\n\nSecond paragraph.',
      OPTIONS,
    )
    cache.renderContent(
      '# Title\n\nFirst paragraph.\n\nSecond paragraph.\n\n```ts\nconst a = 1\n```',
      OPTIONS,
    )
    const final = cache.renderContent(content, OPTIONS)
    const keys = topLevelKeys(final)

    expect(keys).toEqual([
      'markdown-block-0-heading',
      'markdown-block-1-paragraph',
      'markdown-block-2-paragraph',
      'markdown-block-3-code',
      'markdown-block-4-paragraph',
    ])
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('renders work proportional to the delta, not the document', () => {
    const block = 'Paragraph text that wraps across a couple of lines here.\n\n'
    const content = block.repeat(400) // 22 800 chars, 400 blocks
    const chunkLength = Math.floor(content.length / 20)

    let renderedChars = 0
    const renderer = (
      source: string,
      options: Parameters<typeof renderMarkdownWithMeta>[1],
    ): RenderedMarkdownChunk => {
      renderedChars += source.length
      return renderMarkdownWithMeta(source, options)
    }

    const cache = new MarkdownStreamCache(renderer)
    for (let end = chunkLength; end <= content.length; end += chunkLength) {
      cache.renderContent(content.slice(0, end), OPTIONS)
    }

    expect(cache.stats.seeded).toBeGreaterThan(0)
    expect(renderedChars).toBeLessThanOrEqual(2 * content.length + 2000)
  })

  test('resets when the width changes and stays correct', () => {
    const cache = new MarkdownStreamCache()
    const content = 'One paragraph.\n\nTwo paragraph.\n\nThree paragraph.'
    cache.renderContent(content, OPTIONS)
    const resized = cache.renderContent(content, { codeBlockWidth: 60 })

    expect(cache.stats.resets).toBe(1)
    expect(project(resized)).toEqual(
      project(renderMarkdown(content, { codeBlockWidth: 60 })),
    )
  })

  test('resets when the palette identity changes', () => {
    const cache = new MarkdownStreamCache()
    const content = 'One paragraph.\n\nTwo paragraph.\n\nThree paragraph.'
    const firstPalette = { linkFg: '#ff0000' }
    const secondPalette = { linkFg: '#ff0000' }
    cache.renderContent(content, { ...OPTIONS, palette: firstPalette })
    cache.renderContent(content, { ...OPTIONS, palette: secondPalette })

    expect(cache.stats.resets).toBe(1)
  })

  test('resets when content is not a prefix extension', () => {
    const cache = new MarkdownStreamCache()
    cache.renderContent('alpha\n\nbeta\n\ngamma', OPTIONS)
    const replaced = cache.renderContent('other\n\ntext', OPTIONS)

    expect(cache.stats.resets).toBe(1)
    expect(project(replaced)).toEqual(renderClean('other\n\ntext'))
  })

  test('serves a frozen prefix on the flush after seeding', () => {
    const cache = new MarkdownStreamCache()
    cache.renderContent('One paragraph.\n\nTwo paragraph.', OPTIONS)
    cache.renderContent('One paragraph.\n\nTwo paragraph.\n\nThree.', OPTIONS)

    expect(cache.stats.hits).toBe(1)
  })
})

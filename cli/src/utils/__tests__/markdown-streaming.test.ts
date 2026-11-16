import { describe, expect, test } from 'bun:test'
import React from 'react'

import { renderMarkdown } from '../markdown-renderer'
import { MarkdownStreamCache } from '../markdown-stream-cache'

const collectKeys = (value: React.ReactNode, keys: string[] = []): string[] => {
  if (Array.isArray(value)) {
    value.forEach((child) => collectKeys(child, keys))
    return keys
  }
  if (!React.isValidElement(value)) {
    return keys
  }

  if (value.key != null) {
    keys.push(String(value.key))
  }
  const props = value.props as { children?: React.ReactNode }
  collectKeys(props.children, keys)
  return keys
}

const topLevelKeys = (value: React.ReactNode): string[] => {
  const keys: string[] = []
  const visit = (node: React.ReactNode): void => {
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (!React.isValidElement(node)) return
    if (node.type === React.Fragment && node.key == null) {
      visit((node.props as { children?: React.ReactNode }).children)
      return
    }
    if (node.key != null) keys.push(String(node.key))
  }
  visit(value)
  return keys
}

describe('streaming markdown identity', () => {
  test('uses stable semantic keys on production rendered blocks', () => {
    const rendered = renderMarkdown('# Answer\n\nCompleted paragraph.')

    expect(collectKeys(rendered)).toContain('markdown-block-0-heading')
    expect(collectKeys(rendered)).toContain('markdown-block-1-paragraph')
  })

  test('keeps completed block identities stable as the pending fence grows', () => {
    const cache = new MarkdownStreamCache()
    const before = cache.renderContent(
      '# Answer\n\nCompleted paragraph.\n\n```ts\nconst value =',
    )
    const after = cache.renderContent(
      '# Answer\n\nCompleted paragraph.\n\n```ts\nconst value = 42\n// more',
    )

    expect(topLevelKeys(before).slice(0, 2)).toEqual([
      'markdown-block-0-heading',
      'markdown-block-1-paragraph',
    ])
    expect(topLevelKeys(after).slice(0, 2)).toEqual([
      'markdown-block-0-heading',
      'markdown-block-1-paragraph',
    ])
  })

  test('adds a completed fence as a new stable block without renumbering prior blocks', () => {
    const cache = new MarkdownStreamCache()
    const before = cache.renderContent('Intro\n\n```ts\nconst value = 42')
    const after = cache.renderContent(
      'Intro\n\n```ts\nconst value = 42\n```\n\nFollow-up',
    )

    expect(topLevelKeys(before)[0]).toBe('markdown-block-0-paragraph')
    expect(topLevelKeys(after)).toEqual([
      'markdown-block-0-paragraph',
      'markdown-block-1-code',
      'markdown-block-2-paragraph',
    ])
  })
})

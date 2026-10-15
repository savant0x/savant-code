import { describe, expect, test } from 'bun:test'
import React from 'react'

import {
  getStreamingMarkdownBlockManifest,
  renderMarkdown,
} from '../markdown-renderer'

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

describe('streaming markdown identity', () => {
  test('uses stable semantic keys on production rendered blocks', () => {
    const rendered = renderMarkdown('# Answer\n\nCompleted paragraph.')

    expect(collectKeys(rendered)).toContain('markdown-block-0-heading')
    expect(collectKeys(rendered)).toContain('markdown-block-1-paragraph')
  })

  test('keeps completed block identities stable as the pending fence grows', () => {
    const first = getStreamingMarkdownBlockManifest(
      '# Answer\n\nCompleted paragraph.\n```ts\nconst value =',
    )
    const second = getStreamingMarkdownBlockManifest(
      '# Answer\n\nCompleted paragraph.\n```ts\nconst value = 42\n// more',
    )

    expect(first).toEqual(second)
    expect(first).toEqual([
      { key: 'markdown-block-0-heading', kind: 'heading' },
      { key: 'markdown-block-1-paragraph', kind: 'paragraph' },
    ])
  })

  test('adds a completed fence as a new stable block without renumbering prior blocks', () => {
    const before = getStreamingMarkdownBlockManifest(
      'Intro\n\n```ts\nconst value = 42',
    )
    const after = getStreamingMarkdownBlockManifest(
      'Intro\n\n```ts\nconst value = 42\n```\n\nFollow-up',
    )

    expect(after.slice(0, before.length)).toEqual(before)
    expect(after).toEqual([
      { key: 'markdown-block-0-paragraph', kind: 'paragraph' },
      { key: 'markdown-block-1-code', kind: 'code' },
      { key: 'markdown-block-2-paragraph', kind: 'paragraph' },
    ])
  })
})

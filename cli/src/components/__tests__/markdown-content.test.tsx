import { describe, expect, test } from 'bun:test'
import React from 'react'

import { renderMarkdown } from '../../utils/markdown-renderer'
import { renderMarkdownContent } from '../blocks/markdown-content'

import type { ChatTheme } from '../../types/theme-system'

const theme: Pick<ChatTheme, 'foreground'> = { foreground: 'white' }

const getChildren = (value: React.ReactNode): React.ReactNode[] => {
  if (!React.isValidElement(value)) {
    return []
  }
  const children = (value.props as { children?: React.ReactNode }).children
  return Array.isArray(children) ? children : children == null ? [] : [children]
}

const getText = (value: React.ReactNode): string => {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return ''
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map(getText).join('')
  }
  if (React.isValidElement(value)) {
    const props = value.props as {
      children?: React.ReactNode
      content?: string
    }
    return props.content ?? getText(props.children)
  }
  return ''
}

const collectElements = (
  value: React.ReactNode,
  type: string,
  result: React.ReactElement[] = [],
): React.ReactElement[] => {
  if (Array.isArray(value)) {
    value.forEach((child) => collectElements(child, type, result))
    return result
  }
  if (!React.isValidElement(value)) {
    return result
  }
  if (value.type === type) {
    result.push(value)
  }
  collectElements(
    (value.props as { children?: React.ReactNode }).children,
    type,
    result,
  )
  return result
}

describe('renderMarkdownContent', () => {
  test('keeps semantic blocks in one vertical flow with one separator row', () => {
    const output = renderMarkdownContent({
      value: renderMarkdown(
        'A paragraph with **emphasis**.\n\n## A heading\n\n- first\n- second',
      ),
      theme,
      getAttributes: () => undefined,
      keyPrefix: 'message-test',
    })

    expect(React.isValidElement(output)).toBe(true)
    const children = getChildren(output)
    const separators = children.filter(
      (child): child is React.ReactElement =>
        React.isValidElement(child) &&
        child.type === 'text' &&
        getText(child) === '\n',
    )
    const blockBoxes = children.filter(
      (child): child is React.ReactElement =>
        React.isValidElement(child) && child.type === 'box',
    )

    expect(blockBoxes).toHaveLength(3)
    expect(separators).toHaveLength(2)
    expect(collectElements(blockBoxes[0], 'text')).not.toHaveLength(0)
    expect(
      getChildren(blockBoxes[1]).some(
        (child) =>
          React.isValidElement(child) &&
          String(child.key) === 'markdown-block-1-heading-layout-0',
      ),
    ).toBe(true)
    expect(collectElements(blockBoxes[2], 'text')).not.toHaveLength(0)
  })

  test('uses one wrapping text host for inline Markdown fragments', () => {
    const output = renderMarkdownContent({
      value: renderMarkdown('Before **bold** and *italic* after.'),
      theme,
      getAttributes: () => undefined,
      keyPrefix: 'inline-test',
    })

    const textHosts = collectElements(output, 'text')
    expect(textHosts).toHaveLength(1)
    expect(getText(output)).toContain('Before bold and italic after.')

    const hostChildren = getChildren(textHosts[0])
    expect(hostChildren.some((child) => React.isValidElement(child))).toBe(true)
  })

  test('preserves table, divider, and code layout content without blank trailing rows', () => {
    const output = renderMarkdownContent({
      value: renderMarkdown(
        '| Name | Value |\n| --- | --- |\n| one | two |\n\n---\n\n```ts\nconst value = 1\n```',
      ),
      theme,
      getAttributes: () => undefined,
      keyPrefix: 'structured-test',
    })

    const text = getText(output)
    expect(text).toContain('Name')
    expect(text).toContain('one')
    expect(text).toContain('─')
    expect(text).toContain('const value = 1')
    expect(text.endsWith('\n')).toBe(false)

    const rootChildren = getChildren(output)
    const separatorCount = rootChildren.filter(
      (child) =>
        React.isValidElement(child) &&
        child.type === 'text' &&
        getText(child) === '\n',
    ).length
    const blockCount = rootChildren.filter(
      (child) => React.isValidElement(child) && child.type === 'box',
    ).length
    expect(separatorCount).toBe(blockCount - 1)
  })

  test('keeps stable Markdown block keys through the adapter', () => {
    const output = renderMarkdownContent({
      value: renderMarkdown('# Title\n\nBody'),
      theme,
      getAttributes: () => undefined,
      keyPrefix: 'stable-test',
    })

    const blockBoxes = getChildren(output).filter(
      (child): child is React.ReactElement =>
        React.isValidElement(child) && child.type === 'box',
    )

    expect(blockBoxes.map((block) => String(block.key))).toEqual([
      'markdown-block-0-heading',
      'markdown-block-1-paragraph',
    ])
  })
})

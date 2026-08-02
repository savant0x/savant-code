import { describe, expect, test } from 'bun:test'
import { TextAttributes } from '@opentui/core'
import React from 'react'
import { renderExpandedContent } from '../blocks/block-helpers'
import { renderContentWithMarkdown } from '../blocks/content-with-markdown'
import { chatThemes, createMarkdownPalette } from '../../utils/theme-system'

const theme = chatThemes.dark
const palette = createMarkdownPalette(theme)
const getAttributes = (extra = 0) => (extra === 0 ? undefined : extra)

const CustomRenderable = ({ children }: { children?: React.ReactNode }) => (
  <box>{children}</box>
)

const asChildren = (value: React.ReactNode): React.ReactNode[] =>
  Array.isArray(value) ? value : [value]

const collectTextHosts = (value: React.ReactNode): React.ReactElement[] => {
  if (!React.isValidElement(value)) {
    return []
  }

  if (value.type === 'text') {
    return [value]
  }

  const props = value.props as { children?: React.ReactNode }
  return asChildren(props.children).flatMap(collectTextHosts)
}

const assertTextHostsHavePrimitiveChildren = (value: React.ReactNode): void => {
  if (!React.isValidElement(value)) {
    return
  }

  const props = value.props as { children?: React.ReactNode }
  if (value.type === 'text') {
    for (const child of asChildren(props.children)) {
      expect(React.isValidElement(child)).toBe(false)
    }
    return
  }

  asChildren(props.children).forEach(assertTextHostsHavePrimitiveChildren)
}

describe('expanded markdown content', () => {
  test('keeps custom renderable components intact', () => {
    const custom = <CustomRenderable>agent content</CustomRenderable>
    const rendered = renderExpandedContent(custom, theme, getAttributes)

    expect(React.isValidElement(rendered)).toBe(true)
    expect((rendered as React.ReactElement).type).toBe('box')
    expect(
      ((rendered as React.ReactElement<{ children?: React.ReactNode }>).props
        .children as React.ReactElement).type,
    ).toBe(CustomRenderable)
  })

  test('keeps plain text in an OpenTUI text host', () => {
    const rendered = renderExpandedContent(
      renderContentWithMarkdown({
        content: 'plain response',
        isStreaming: false,
        codeBlockWidth: 72,
        palette,
      }),
      theme,
      getAttributes,
    )

    expect(React.isValidElement(rendered)).toBe(true)
    expect((rendered as React.ReactElement).type).toBe('text')
  })

  test('preserves inline markdown styles with primitive text hosts', () => {
    const rendered = renderExpandedContent(
      renderContentWithMarkdown({
        content: '**bold** and *italic*',
        isStreaming: false,
        codeBlockWidth: 72,
        palette,
      }),
      theme,
      getAttributes,
    )

    expect(React.isValidElement(rendered)).toBe(true)
    expect((rendered as React.ReactElement).type).toBe('box')

    assertTextHostsHavePrimitiveChildren(rendered)

    const textHosts = collectTextHosts(rendered)
    expect(textHosts.length).toBeGreaterThanOrEqual(2)
    expect(textHosts.some((host) => {
      const props = host.props as { attributes?: number }
      return props.attributes === TextAttributes.BOLD
    })).toBe(true)
    expect(textHosts.some((host) => {
      const props = host.props as { attributes?: number }
      return props.attributes === TextAttributes.ITALIC
    })).toBe(true)
  })

  test('stringifies numeric content for OpenTUI text hosts', () => {
    const rendered = renderExpandedContent(404, theme, getAttributes)

    expect(React.isValidElement(rendered)).toBe(true)
    expect((rendered as React.ReactElement).type).toBe('text')
    expect(
      (rendered as React.ReactElement<{ children?: React.ReactNode }>).props
        .children,
    ).toBe('404')
  })

  test('places rich markdown layout nodes in an OpenTUI box host', () => {
    const rendered = renderExpandedContent(
      renderContentWithMarkdown({
        content: '```ts\nconst answer = 42\n```',
        isStreaming: false,
        codeBlockWidth: 72,
        palette,
      }),
      theme,
      getAttributes,
    )

    expect(React.isValidElement(rendered)).toBe(true)
    expect((rendered as React.ReactElement).type).toBe('box')
  })
})

// Markdown renderer test family — inline emphasis, headings, links/images,
// code panels, blockquotes, lists, streaming, GFM strikethrough and task
// lists. Sibling of the Loop-336 decomposition (shared helpers in
// ./markdown-renderer-test-harness).

import { TextAttributes } from '@opentui/core'
import { describe, expect, test } from 'bun:test'
import React from 'react'

import {
  MarkdownImage,
  MarkdownLink,
} from '../../components/blocks/markdown-renderables'
import { renderMarkdown, renderStreamingMarkdown } from '../markdown-renderer'
import { chatThemes } from '../theme-system'
import { flattenChildren, flattenNodes } from './markdown-renderer-test-harness'

import type { El} from './markdown-renderer-test-harness';

describe('markdown renderer', () => {
  test('renders bold and italic emphasis', () => {
    const output = renderMarkdown('Hello **bold** and *italic*!')
    const nodes = flattenNodes(output)

    expect(nodes[0]).toBe('Hello ')

    const bold = nodes[1] as El
    expect(bold.props.attributes).toBe(TextAttributes.BOLD)
    expect(flattenChildren(bold.props.children)).toEqual(['bold'])

    expect(nodes[2]).toBe(' and ')

    const italic = nodes[3] as El
    expect(italic.props.attributes).toBe(TextAttributes.ITALIC)
    expect(flattenChildren(italic.props.children)).toEqual(['italic'])

    expect(nodes[4]).toBe('!')
  })

  test('renders inline code with palette colors', () => {
    const output = renderMarkdown('Use `ls` to list files.')
    const nodes = flattenNodes(output)

    expect(nodes[0]).toBe('Use ')

    const inlineCode = nodes[1] as El
    expect(inlineCode.props.fg).toBe('green')
    expect(inlineCode.props.bg).toBe('black')
    expect(flattenChildren(inlineCode.props.children)).toEqual([' ls '])

    expect(nodes[2]).toBe(' to list files.')
  })

  test('renders headings as depth-aware semantic rows', () => {
    const output = renderMarkdown('# Heading One')
    const nodes = flattenNodes(output)

    const heading = nodes[0] as El
    expect(heading.type).toBeDefined()
    expect(String(heading.type)).toContain('MarkdownHeading')
    expect(heading.props.depth).toBe(1)
    expect(heading.props.color).toBe('green')
    expect(flattenChildren(heading.props.children)).toEqual(['Heading One'])

    const deepOutput = renderMarkdown('###### Deep heading')
    const deepHeading = flattenNodes(deepOutput)[0] as El
    expect(deepHeading.props.depth).toBe(6)
    expect(deepHeading.props.depth).not.toBe(heading.props.depth)
  })

  test('renders inline emphasis inside headings without extra spacing', () => {
    const output = renderMarkdown(
      '# Other**.github/** - GitHub workflows and config',
    )
    const nodes = flattenNodes(output)

    const heading = nodes[0] as El
    const contents = flattenChildren(heading.props.children)

    expect(contents[0]).toBe('Other')

    const strong = contents[1] as El
    expect(strong.props.attributes).toBe(TextAttributes.BOLD)
    expect(flattenChildren(strong.props.children)).toEqual(['.github/'])

    expect(contents[2]).toBe(' - GitHub workflows and config')
  })

  test('keeps links and images as structural semantic nodes', () => {
    const output = renderMarkdown(
      '[OpenTUI](https://opentui.dev) and ![diagram](https://example.com/diagram.png)',
    )
    const nodes = flattenNodes(output)
    const link = nodes.find(
      (node): node is El =>
        React.isValidElement(node) &&
        String(node.type).includes('MarkdownLink'),
    )
    const image = nodes.find(
      (node): node is El =>
        React.isValidElement(node) &&
        String(node.type).includes('MarkdownImage'),
    )

    expect(link?.type).toBe(MarkdownLink)
    expect(link?.props.href).toBe('https://opentui.dev')
    expect(image?.type).toBe(MarkdownImage)
    expect(image?.props.src).toBe('https://example.com/diagram.png')
  })

  test('renders themed fenced code inside a bounded panel', () => {
    const output = renderMarkdown('```ts\nconst value = 1\n```', {
      theme: chatThemes.dark,
      codeBlockWidth: 20,
    })
    const nodes = flattenNodes(output)
    const panel = nodes.find(
      (node): node is El => React.isValidElement(node) && node.type === 'box',
    )

    expect(panel).toBeDefined()
    const panelStyle = panel?.props.style as { width?: number }
    expect(panelStyle.width).toBe(20)
    expect(flattenChildren(panel?.props.children)).toHaveLength(1)
  })

  test('renders blockquotes with prefix', () => {
    const output = renderMarkdown('> note')
    const nodes = flattenNodes(output)

    const prefixSpan = nodes[0] as El
    expect(prefixSpan.props.fg).toBe('gray')
    expect(flattenChildren(prefixSpan.props.children)).toEqual(['> '])

    const textSpan = nodes[1] as El
    expect(textSpan.props.fg).toBe('gray')
    expect(flattenChildren(textSpan.props.children)).toEqual(['note'])
  })

  test('renders lists with bullet markers', () => {
    const output = renderMarkdown('- first\n- second')
    const nodes = flattenNodes(output)

    const bulletSpans = nodes.filter(
      (node): node is El =>
        React.isValidElement(node) &&
        node.type === 'span' &&
        flattenChildren((node as El).props.children).join('') === '- ',
    )

    expect(bulletSpans).toHaveLength(2)
    bulletSpans.forEach((span) => expect(span.props.fg).toBe('white'))

    const textNodes = nodes
      .filter((node): node is string => typeof node === 'string')
      .map((value) => value.trim())
      .filter(Boolean)
    expect(textNodes).toContain('first')
    expect(textNodes).toContain('second')
  })

  test('renders markdown without closing code fence while streaming', () => {
    const content = '**done**\n```js\nconsole.log('
    const output = renderStreamingMarkdown(content)
    const nodes = flattenNodes(output)

    const boldNode = nodes.find(
      (node): node is El =>
        React.isValidElement(node) &&
        (node as El).props !== undefined &&
        (node as El).props.attributes === TextAttributes.BOLD,
    )

    expect(boldNode).toBeDefined()
    expect(flattenChildren(boldNode!.props.children)).toEqual(['done'])
    expect(nodes[nodes.length - 1]).toBe('```js\nconsole.log(')
  })

  test('renders strikethrough text with GFM', () => {
    const output = renderMarkdown('This is ~~deleted~~ text')
    const nodes = flattenNodes(output)

    expect(nodes[0]).toBe('This is ')

    const strikethrough = nodes[1] as El
    expect(strikethrough.props.attributes).toBe(TextAttributes.DIM)
    expect(flattenChildren(strikethrough.props.children)).toEqual(['deleted'])

    expect(nodes[2]).toBe(' text')
  })

  test('renders task lists with GFM', () => {
    const output = renderMarkdown('- [ ] Todo\n- [x] Done')
    const nodes = flattenNodes(output)

    const checkboxSpans = nodes.filter(
      (node): node is El =>
        React.isValidElement(node) &&
        node.type === 'span' &&
        (flattenChildren((node as El).props.children).join('') === '[ ] ' ||
          flattenChildren((node as El).props.children).join('') === '[x] '),
    )

    expect(checkboxSpans).toHaveLength(2)
  })
})

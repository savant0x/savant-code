import { TextAttributes } from '@opentui/core'

import {
  renderBlockquote as renderBlockquoteImpl,
  renderHeading as renderHeadingImpl,
  renderList as renderListImpl,
} from './markdown-block-renderers'
import {
  KeyedFragment,
  renderCodeBlock,
  renderInlineCode,
  renderLink,
  wrapSegmentsInFragments,
} from './markdown-leaves'
import { renderTable } from './markdown-tables'
import { nodeToPlainText } from './markdown-text'
import { MarkdownImage } from '../components/blocks/markdown-renderables'

import type { MarkdownNode } from './markdown-inline'
import type { RenderState } from './markdown-types'
import type {
  Blockquote,
  Emphasis,
  Heading,
  Image,
  List,
  ListItem,
  Paragraph,
  Root,
  Strong,
  Table,
  Text,
} from 'mdast'
import type { ReactNode } from 'react'

export const renderNodes = (
  children: MarkdownNode[],
  state: RenderState,
  parentType: MarkdownNode['type'],
): ReactNode[] => {
  const results: ReactNode[] = []
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]
    const nextSibling = children[index + 1] as MarkdownNode | undefined
    results.push(...renderNode(child, state, parentType, nextSibling))
  }
  return results
}

export const renderBlockquote = (
  blockquote: Blockquote,
  state: RenderState,
): ReactNode[] => renderBlockquoteImpl(blockquote, state, renderNodes)

export const renderList = (list: List, state: RenderState): ReactNode[] =>
  renderListImpl(list, state, renderNodes)

export const renderHeading = (
  heading: Heading,
  state: RenderState,
): ReactNode[] => renderHeadingImpl(heading, state, renderNodes)

export const renderNode = (
  node: MarkdownNode,
  state: RenderState,
  parentType: MarkdownNode['type'],
  nextSibling?: MarkdownNode,
): ReactNode[] => {
  switch (node.type) {
    case 'root': {
      const root = node as Root
      return root.children.flatMap((child, index) => {
        const renderedBlock = renderNode(
          child as MarkdownNode,
          state,
          node.type,
          root.children[index + 1] as MarkdownNode | undefined,
        )
        return [
          <KeyedFragment key={`markdown-block-${index}-${child.type}`}>
            {renderedBlock}
          </KeyedFragment>,
        ]
      })
    }

    case 'paragraph': {
      const children = renderNodes(
        (node as Paragraph).children as MarkdownNode[],
        state,
        node.type,
      )
      const nodes = [...children]
      if (parentType === 'listItem') {
        nodes.push('\n')
      } else if (parentType === 'blockquote') {
        nodes.push('\n')
      } else {
        const isTightFollowup =
          parentType === 'root' &&
          nextSibling &&
          (nextSibling.type === 'blockquote' || nextSibling.type === 'list')
        nodes.push(isTightFollowup ? '\n' : '\n')
      }
      return nodes
    }

    case 'text':
      return [(node as Text).value]

    case 'strong': {
      const children = renderNodes(
        (node as Strong).children as MarkdownNode[],
        state,
        node.type,
      )
      return [
        <span key={state.nextKey()} attributes={TextAttributes.BOLD}>
          {wrapSegmentsInFragments(children, state.nextKey())}
        </span>,
      ]
    }

    case 'emphasis': {
      const children = renderNodes(
        (node as Emphasis).children as MarkdownNode[],
        state,
        node.type,
      )
      return [
        <span key={state.nextKey()} attributes={TextAttributes.ITALIC}>
          {wrapSegmentsInFragments(children, state.nextKey())}
        </span>,
      ]
    }

    case 'inlineCode':
      return renderInlineCode(node as never, state)

    case 'heading':
      return renderHeading(node as Heading, state)

    case 'list':
      return renderList(node as List, state)

    case 'listItem': {
      return renderNodes(
        (node as ListItem).children as MarkdownNode[],
        state,
        node.type,
      )
    }

    case 'blockquote':
      return renderBlockquote(node as Blockquote, state)

    case 'code':
      return renderCodeBlock(node as never, state)

    case 'break':
      return ['\n']

    case 'thematicBreak': {
      const width = Math.max(1, Math.min(state.codeBlockWidth, 80))
      const divider = '─'.repeat(width)
      return [
        <span key={state.nextKey()} fg={state.palette.dividerFg}>
          {divider}
        </span>,
        '\n',
      ]
    }

    case 'link':
      return renderLink(node as never, state)

    case 'image': {
      const image = node as Image
      return [
        <MarkdownImage
          key={state.nextKey()}
          src={image.url}
          alt={image.alt ?? undefined}
          availableWidth={state.codeBlockWidth}
        />,
        '\n',
      ]
    }

    case 'table':
      return renderTable(node as Table, state)

    case 'delete': {
      // Strikethrough from GFM
      const deleteNode = node as { children?: MarkdownNode[] }
      const children = renderNodes(
        (deleteNode.children ?? []) as MarkdownNode[],
        state,
        node.type,
      )
      return [
        <span key={state.nextKey()} attributes={TextAttributes.DIM}>
          {wrapSegmentsInFragments(children, state.nextKey())}
        </span>,
      ]
    }

    default: {
      const fallbackText = nodeToPlainText(node)
      if (fallbackText) {
        return [fallbackText]
      }

      const nodeWithChildren = node as { children?: MarkdownNode[] }
      if (Array.isArray(nodeWithChildren.children)) {
        return renderNodes(nodeWithChildren.children, state, node.type)
      }

      return []
    }
  }
}

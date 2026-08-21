import { KeyedFragment, wrapSegmentsInFragments } from './markdown-leaves'
import { splitNodesByNewline, trimTrailingBreaks } from './markdown-text'
import { MarkdownHeading } from '../components/blocks/markdown-renderables'

import type { MarkdownNode } from './markdown-inline'
import type { RenderState } from './markdown-types'
import type { Blockquote, Heading, List, ListItem } from 'mdast'
import type { ReactNode } from 'react'

export type RenderNodes = (
  children: MarkdownNode[],
  state: RenderState,
  parentType: MarkdownNode['type'],
) => ReactNode[]

export const renderBlockquote = (
  blockquote: Blockquote,
  state: RenderState,
  renderNodes: RenderNodes,
): ReactNode[] => {
  const { palette, nextKey } = state
  const childNodes = renderNodes(
    blockquote.children as MarkdownNode[],
    state,
    blockquote.type,
  )
  const lines = splitNodesByNewline(childNodes)
  const nodes: ReactNode[] = []

  lines.forEach((line, index) => {
    if (line.length === 0) {
      return
    }
    nodes.push(
      <span key={nextKey()} fg={palette.blockquoteBorderFg}>
        {'> '}
      </span>,
    )
    nodes.push(
      <span key={nextKey()} fg={palette.blockquoteTextFg}>
        {wrapSegmentsInFragments(line, nextKey())}
      </span>,
    )
    if (index < lines.length - 1) {
      nodes.push('\n')
    }
  })

  nodes.push('\n')
  return nodes
}

export const renderList = (
  list: List,
  state: RenderState,
  renderNodes: RenderNodes,
): ReactNode[] => {
  const { palette, nextKey } = state
  const nodes: ReactNode[] = []
  const start = list.start ?? 1

  list.children.forEach((item, idx) => {
    const listItem = item as ListItem
    const marker =
      listItem.checked === true
        ? '[x] '
        : listItem.checked === false
          ? '[ ] '
          : list.ordered
            ? `${start + idx}. `
            : '- '

    nodes.push(
      <span key={nextKey()} fg={palette.listBulletFg}>
        {marker}
      </span>,
    )

    const itemNodes = trimTrailingBreaks(
      renderNodes(listItem.children as MarkdownNode[], state, listItem.type),
    )
    if (itemNodes.length === 0) {
      nodes.push('\n')
    } else {
      nodes.push(
        <KeyedFragment key={nextKey()}>
          {wrapSegmentsInFragments(itemNodes, nextKey())}
        </KeyedFragment>,
      )
      nodes.push('\n')
    }
  })

  nodes.push('\n')
  return nodes
}

export const renderHeading = (
  heading: Heading,
  state: RenderState,
  renderNodes: RenderNodes,
): ReactNode[] => {
  const { nextKey } = state
  const depth = Math.max(1, Math.min(6, heading.depth))
  const color = state.palette.headingFg[depth] ?? state.palette.headingFg[6]
  const childNodes = renderNodes(
    heading.children as MarkdownNode[],
    state,
    heading.type,
  )

  return [
    <MarkdownHeading key={nextKey()} depth={depth} color={color}>
      {childNodes.filter((child) => child !== '\n')}
    </MarkdownHeading>,
    '\n',
  ]
}

import { TextAttributes } from '@opentui/core'
import React from 'react'

import { getChildrenText, wrapText } from './markdown-text'
import { MarkdownLink } from '../components/blocks/markdown-renderables'

import type { MarkdownNode } from './markdown-inline'
import type { RenderState } from './markdown-types'
import type { Code, InlineCode, Link } from 'mdast'
import type { ReactNode } from 'react'

// Helper component to work around TypeScript's Fragment key typing issue
export const KeyedFragment = React.Fragment as React.FC<{
  key?: string | number
  children?: ReactNode
}>

// Helper to wrap segments in KeyedFragments
export const wrapSegmentsInFragments = (
  segments: ReactNode[],
  keyPrefix: string,
): ReactNode => {
  return segments.map((segment, idx) => (
    <KeyedFragment key={keyPrefix + '-' + idx}>{segment}</KeyedFragment>
  ))
}

export const renderCodeBlock = (
  code: Code,
  state: RenderState,
): ReactNode[] => {
  const { palette, nextKey, syntaxStyle, codeBlockWidth } = state
  const nodes: ReactNode[] = []

  if (code.lang) {
    nodes.push(
      <span key={nextKey()} fg={palette.codeHeaderFg}>
        {`// ${code.lang}`}
      </span>,
      '\n',
    )
  }

  // FID-033e: render code blocks with OpenTUI SyntaxStyle when a theme is
  // available; fall back to the previous plain-text span rendering otherwise.
  if (syntaxStyle && codeBlockWidth >= 5) {
    nodes.push(
      <box
        key={nextKey()}
        style={{
          flexDirection: 'column',
          width: Math.max(1, codeBlockWidth),
          border: true,
          borderStyle: 'rounded',
          borderColor: palette.dividerFg,
          backgroundColor: palette.codeBackground,
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <box
          style={{
            width: Math.max(1, codeBlockWidth - 4),
            flexShrink: 1,
          }}
        >
          <code
            content={code.value}
            filetype={code.lang ?? 'text'}
            syntaxStyle={syntaxStyle}
          />
        </box>
      </box>,
    )
  } else {
    const lines = code.value.split('\n')
    const lineWidth = Math.max(1, codeBlockWidth)
    lines.forEach((line, lineIndex) => {
      const wrappedLines = wrapText(line, lineWidth)
      wrappedLines.forEach((wrappedLine, wrappedIndex) => {
        const displayLine = wrappedLine === '' ? ' ' : wrappedLine
        nodes.push(
          <span
            key={nextKey()}
            fg={palette.codeTextFg}
            bg={palette.codeMonochrome ? undefined : palette.codeBackground}
          >
            {displayLine}
          </span>,
        )
        if (
          wrappedIndex < wrappedLines.length - 1 ||
          lineIndex < lines.length - 1
        ) {
          nodes.push('\n')
        }
      })
    })
  }

  nodes.push('\n')
  return nodes
}

export const renderInlineCode = (
  inlineCode: InlineCode,
  state: RenderState,
): ReactNode[] => {
  const { palette, nextKey } = state
  const content = inlineCode.value || ' '
  return [
    <span
      key={nextKey()}
      fg={palette.inlineCodeFg}
      bg={palette.codeMonochrome ? undefined : palette.codeBackground}
      attributes={TextAttributes.BOLD}
    >
      {` ${content} `}
    </span>,
  ]
}

export const renderLink = (link: Link, state: RenderState): ReactNode[] => {
  const { nextKey } = state
  const label =
    getChildrenText(link.children as MarkdownNode[]).trim() || link.url

  return [
    <MarkdownLink key={nextKey()} href={link.url}>
      {label}
    </MarkdownLink>,
  ]
}

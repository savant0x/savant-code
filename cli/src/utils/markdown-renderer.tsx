import { TextAttributes } from '@opentui/core'
import React from 'react'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import stringWidth from 'string-width'
import { unified } from 'unified'

import { logger } from './logger'
import { createSyntaxStyle } from './syntax-theme'
import { createMarkdownPalette } from './theme-system'
import {
  MarkdownHeading,
  MarkdownImage,
  MarkdownLink,
} from '../components/blocks/markdown-renderables'

import type { ChatTheme } from '../types/theme-system'
import type { SyntaxStyle } from '@opentui/core'
import type {
  Blockquote,
  Code,
  Content,
  Emphasis,
  Heading,
  InlineCode,
  Link,
  Image,
  List,
  ListItem,
  Paragraph,
  Root,
  Strong,
  Table,
  TableCell,
  TableRow,
  Text,
} from 'mdast'
import type { ReactNode } from 'react'

// Helper component to work around TypeScript's Fragment key typing issue
const KeyedFragment = React.Fragment as React.FC<{
  key?: string | number
  children?: ReactNode
}>

// Helper to wrap segments in KeyedFragments
const wrapSegmentsInFragments = (
  segments: ReactNode[],
  keyPrefix: string,
): ReactNode => {
  return segments.map((segment, idx) => (
    <KeyedFragment key={keyPrefix + '-' + idx}>{segment}</KeyedFragment>
  ))
}

export interface MarkdownPalette {
  inlineCodeFg: string
  codeBackground: string
  codeHeaderFg: string
  headingFg: Record<number, string>
  listBulletFg: string
  blockquoteBorderFg: string
  blockquoteTextFg: string
  dividerFg: string
  codeTextFg: string
  codeMonochrome: boolean
  linkFg: string
}

export interface MarkdownRenderOptions {
  palette?: Partial<MarkdownPalette>
  codeBlockWidth?: number
  theme?: ChatTheme
}

const defaultPalette: MarkdownPalette = {
  inlineCodeFg: 'green',
  codeBackground: 'black',
  codeHeaderFg: 'gray',
  headingFg: {
    1: 'green',
    2: 'green',
    3: 'green',
    4: 'green',
    5: 'green',
    6: 'green',
  },
  listBulletFg: 'white',
  blockquoteBorderFg: 'gray',
  blockquoteTextFg: 'gray',
  dividerFg: 'gray',
  codeTextFg: 'white',
  codeMonochrome: false,
  linkFg: 'blue',
}

const resolvePalette = (
  base: MarkdownPalette = defaultPalette,
  overrides?: Partial<MarkdownPalette>,
): MarkdownPalette => {
  const palette: MarkdownPalette = {
    ...base,
    headingFg: { ...base.headingFg },
  }

  if (!overrides) {
    return palette
  }

  const { headingFg, ...rest } = overrides
  Object.assign(palette, rest)

  if (headingFg) {
    palette.headingFg = {
      ...palette.headingFg,
      ...headingFg,
    }
  }

  return palette
}

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkBreaks)

type MarkdownNode = Content | Root

type InlineFallbackNode = Text | Strong | Emphasis

interface RenderState {
  palette: MarkdownPalette
  codeBlockWidth: number
  nextKey: () => string
  syntaxStyle?: SyntaxStyle
}

const createRenderState = (
  palette: MarkdownPalette,
  codeBlockWidth: number,
  syntaxStyle?: SyntaxStyle,
): RenderState => {
  let counter = 0
  return {
    palette,
    codeBlockWidth,
    syntaxStyle,
    nextKey: () => {
      counter += 1
      return `markdown-${counter}`
    },
  }
}

// Unified trim helper with predicate
const trimTrailingNodes = (
  nodes: ReactNode[],
  predicate: (node: ReactNode) => boolean,
): ReactNode[] => {
  let end = nodes.length
  while (end > 0 && predicate(nodes[end - 1])) {
    end -= 1
  }
  return end === nodes.length ? nodes : nodes.slice(0, end)
}

const trimTrailingWhitespaceNodes = (nodes: ReactNode[]): ReactNode[] => {
  return trimTrailingNodes(
    nodes,
    (node) => typeof node === 'string' && node.trim().length === 0,
  )
}

const trimTrailingBreaks = (nodes: ReactNode[]): ReactNode[] => {
  return trimTrailingNodes(
    nodes,
    (node) => typeof node === 'string' && /^\n+$/.test(node),
  )
}

const splitNodesByNewline = (nodes: ReactNode[]): ReactNode[][] => {
  const lines: ReactNode[][] = [[]]
  nodes.forEach((node) => {
    if (typeof node === 'string') {
      const parts = node.split('\n')
      parts.forEach((part, idx) => {
        if (part.length > 0) {
          lines[lines.length - 1].push(part)
        }
        if (idx < parts.length - 1) {
          lines.push([])
        }
      })
    } else {
      lines[lines.length - 1].push(node)
    }
  })
  return lines
}

const hasUnescapedMarker = (value: string): boolean => {
  if (!value) {
    return false
  }
  const markers = ['**', '*']
  return markers.some((marker) => {
    let idx = value.indexOf(marker)
    while (idx !== -1) {
      let backslashes = 0
      for (
        let offset = idx - 1;
        offset >= 0 && value[offset] === '\\';
        offset -= 1
      ) {
        backslashes += 1
      }
      if (backslashes % 2 === 0) {
        return true
      }
      idx = value.indexOf(marker, idx + marker.length)
    }
    return false
  })
}

const findClosingDelimiter = (
  value: string,
  start: number,
  marker: string,
): number => {
  let idx = start
  while (idx < value.length) {
    idx = value.indexOf(marker, idx)
    if (idx === -1) {
      return -1
    }
    let backslashes = 0
    for (
      let offset = idx - 1;
      offset >= 0 && value[offset] === '\\';
      offset -= 1
    ) {
      backslashes += 1
    }
    if (backslashes % 2 === 0) {
      return idx
    }
    idx += marker.length
  }
  return -1
}

/**
 * Remark follows CommonMark's emphasis rules, which ignore some practical
 * patterns (e.g., `Other**.github/**`). This fallback splits leftover text
 * nodes on emphasis markers so we still render inline styling in those cases.
 */
const parseInlineFallback = (value: string): InlineFallbackNode[] => {
  if (!value || !hasUnescapedMarker(value)) {
    return [{ type: 'text', value }]
  }

  const nodes: InlineFallbackNode[] = []
  let buffer = ''

  const flushBuffer = () => {
    if (buffer.length > 0) {
      nodes.push({ type: 'text', value: buffer })
      buffer = ''
    }
  }

  let index = 0
  while (index < value.length) {
    const char = value[index]

    if (char === '*') {
      const markerChar = char
      const isDouble =
        index + 1 < value.length && value[index + 1] === markerChar
      const marker = isDouble ? markerChar.repeat(2) : markerChar
      const markerLength = marker.length

      let backslashes = 0
      for (
        let offset = index - 1;
        offset >= 0 && value[offset] === '\\';
        offset -= 1
      ) {
        backslashes += 1
      }

      if (backslashes % 2 === 1) {
        buffer += marker
        index += markerLength
        continue
      }

      const closing = findClosingDelimiter(value, index + markerLength, marker)
      if (closing === -1) {
        buffer += marker
        index += markerLength
        continue
      }

      const inner = value.slice(index + markerLength, closing)
      flushBuffer()
      const children = parseInlineFallback(inner).filter(
        (node) => !(node.type === 'text' && node.value.length === 0),
      )

      const emphasisNode: InlineFallbackNode = isDouble
        ? { type: 'strong', children }
        : { type: 'emphasis', children }

      nodes.push(emphasisNode)
      index = closing + markerLength
      continue
    }

    buffer += char
    index += 1
  }

  flushBuffer()

  if (nodes.length === 0) {
    return [{ type: 'text', value }]
  }

  return nodes
}

const applyInlineFallbackFormatting = (node: MarkdownNode): void => {
  if (!node || typeof node !== 'object') {
    return
  }

  const mutable = node as { children?: MarkdownNode[] }
  if (!Array.isArray(mutable.children)) {
    return
  }

  const nextChildren: MarkdownNode[] = []

  mutable.children.forEach((child) => {
    if (child.type === 'text') {
      const replacements = parseInlineFallback(child.value)
      const hasChanges =
        replacements.length !== 1 ||
        replacements[0].type !== 'text' ||
        replacements[0].value !== child.value

      if (hasChanges) {
        replacements.forEach((replacement) => {
          if (replacement.type === 'text') {
            nextChildren.push(replacement)
          } else {
            applyInlineFallbackFormatting(
              replacement as unknown as MarkdownNode,
            )
            nextChildren.push(replacement as unknown as MarkdownNode)
          }
        })
        return
      }
    } else {
      applyInlineFallbackFormatting(child as MarkdownNode)
    }

    nextChildren.push(child as MarkdownNode)
  })

  mutable.children = nextChildren
}

const getChildrenText = (children: MarkdownNode[]): string => {
  return children.map(nodeToPlainText).join('')
}

const nodeToPlainText = (node: MarkdownNode): string => {
  switch (node.type) {
    case 'root':
      return getChildrenText((node as Root).children as MarkdownNode[])

    case 'paragraph':
      return (
        getChildrenText((node as Paragraph).children as MarkdownNode[]) + '\n\n'
      )

    case 'text':
      return (node as Text).value

    case 'strong':
      return getChildrenText((node as Strong).children as MarkdownNode[])

    case 'emphasis':
      return getChildrenText((node as Emphasis).children as MarkdownNode[])

    case 'inlineCode':
      return (node as InlineCode).value

    case 'heading': {
      const heading = node as Heading
      const prefix = '#'.repeat(Math.max(1, Math.min(heading.depth, 6)))
      const content = getChildrenText(heading.children as MarkdownNode[])
      return `${prefix} ${content}\n\n`
    }

    case 'list': {
      const list = node as List
      return (
        list.children
          .map((item, idx) => {
            const marker = list.ordered ? `${(list.start ?? 1) + idx}. ` : '- '
            const text = getChildrenText(
              (item as ListItem).children as MarkdownNode[],
            ).trimEnd()
            return marker + text
          })
          .join('\n') + '\n\n'
      )
    }

    case 'listItem':
      return getChildrenText((node as ListItem).children as MarkdownNode[])

    case 'blockquote': {
      const blockquote = node as Blockquote
      const content = blockquote.children
        .map((child) => nodeToPlainText(child).replace(/^/gm, '> '))
        .join('')
      return `${content}\n\n`
    }

    case 'code': {
      const code = node as Code
      const header = code.lang ? `\`\`\`${code.lang}\n` : '```\n'
      return `${header}${code.value}\n\`\`\`\n\n`
    }

    case 'break':
      return '\n'

    case 'thematicBreak':
      return '---\n\n'

    case 'link': {
      const link = node as Link
      const label =
        link.children.length > 0
          ? getChildrenText(link.children as MarkdownNode[])
          : link.url
      return label
    }

    case 'table': {
      const table = node as Table
      return (
        table.children
          .map((row) => {
            const cells = (row as TableRow).children as TableCell[]
            return cells.map((cell) => nodeToPlainText(cell)).join(' | ')
          })
          .join('\n') + '\n\n'
      )
    }

    case 'tableRow':
      return (node as TableRow).children.map(nodeToPlainText).join(' | ')

    case 'tableCell':
      return getChildrenText((node as TableCell).children as MarkdownNode[])

    case 'delete': {
      // Strikethrough - just return the text content
      const deleteNode = node as { children?: MarkdownNode[] }
      if (Array.isArray(deleteNode.children)) {
        return getChildrenText(deleteNode.children)
      }
      return ''
    }

    default: {
      const nodeWithChildren = node as { children?: MarkdownNode[] }
      if (Array.isArray(nodeWithChildren.children)) {
        return getChildrenText(nodeWithChildren.children)
      }
      return ''
    }
  }
}

const renderNodes = (
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

const renderCodeBlock = (code: Code, state: RenderState): ReactNode[] => {
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

const renderBlockquote = (
  blockquote: Blockquote,
  state: RenderState,
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

const renderList = (list: List, state: RenderState): ReactNode[] => {
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

const renderHeading = (heading: Heading, state: RenderState): ReactNode[] => {
  const { palette, nextKey } = state
  const depth = Math.max(1, Math.min(6, heading.depth))
  const color = palette.headingFg[depth] ?? palette.headingFg[6]
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

const renderInlineCode = (
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

const renderLink = (link: Link, state: RenderState): ReactNode[] => {
  const { nextKey } = state
  const label =
    getChildrenText(link.children as MarkdownNode[]).trim() || link.url

  return [
    <MarkdownLink key={nextKey()} href={link.url}>
      {label}
    </MarkdownLink>,
  ]
}

/**
 * Wraps text to fit within a specified width, returning an array of lines.
 * Uses stringWidth to properly measure Unicode and wide characters.
 * Performs word-wrapping where possible, falling back to character-level
 * breaking for words that exceed the column width.
 */
const wrapText = (text: string, maxWidth: number): string[] => {
  if (maxWidth < 1) return ['']
  if (!text) return ['']
  const textWidth = stringWidth(text)
  if (textWidth <= maxWidth) return [text]

  const lines: string[] = []
  let currentLine = ''
  let currentWidth = 0
  const tokens = text.split(/(\s+)/)

  for (const token of tokens) {
    if (!token) continue
    const tokenWidth = stringWidth(token)
    const isWhitespace = /^\s+$/.test(token)

    // Skip leading whitespace on new lines
    if (isWhitespace && currentWidth === 0) continue

    if (tokenWidth > maxWidth && !isWhitespace) {
      // Break long words character by character
      for (const char of token) {
        const charWidth = stringWidth(char)
        // A wide grapheme cannot be split across terminal cells. Replace it
        // with a single-cell marker at the narrowest budget so the renderer
        // never emits a row wider than its owner.
        const fittedChar = charWidth > maxWidth ? '·' : char
        const fittedWidth = stringWidth(fittedChar)
        if (currentWidth + fittedWidth > maxWidth) {
          if (currentLine) lines.push(currentLine)
          currentLine = fittedChar
          currentWidth = fittedWidth
        } else {
          currentLine += fittedChar
          currentWidth += fittedWidth
        }
      }
    } else if (currentWidth + tokenWidth > maxWidth) {
      if (currentLine) lines.push(currentLine.trimEnd())
      currentLine = isWhitespace ? '' : token
      currentWidth = isWhitespace ? 0 : tokenWidth
    } else {
      currentLine += token
      currentWidth += tokenWidth
    }
  }

  if (currentLine) lines.push(currentLine.trimEnd())
  return lines.length > 0 ? lines : ['']
}

/**
 * Pads text to reach exact width using spaces.
 */
const padText = (text: string, targetWidth: number): string => {
  const currentWidth = stringWidth(text)
  if (currentWidth >= targetWidth) return text
  return text + ' '.repeat(targetWidth - currentWidth)
}

const renderTable = (table: Table, state: RenderState): ReactNode[] => {
  const { palette, nextKey, codeBlockWidth } = state
  const nodes: ReactNode[] = []

  // Extract all rows and their plain text content
  const rows = table.children.map((row) => {
    const cells = (row as TableRow).children as TableCell[]
    return cells.map((cell) => nodeToPlainText(cell).trim())
  })

  if (rows.length === 0) return nodes

  // Determine number of columns
  const numCols = Math.max(...rows.map((r) => r.length))
  if (numCols === 0) return nodes

  // Calculate natural column widths (minimum 3 chars per column)
  const naturalWidths: number[] = Array(numCols).fill(3)
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      const cellWidth = stringWidth(row[i] || '')
      naturalWidths[i] = Math.max(naturalWidths[i], cellWidth)
    }
  }

  // Calculate total width needed:
  // Each column has its content width
  // Separators: " │ " between columns (3 chars each), none at edges
  const totalNaturalWidth =
    1 + naturalWidths.reduce((a, b) => a + b, 0) + numCols * 3

  // Every rendered table line has one left border, one right border per cell,
  // and two padding columns per cell. Derive the cell budget from the owning
  // content width; never use a fixed minimum that can exceed a narrow terminal.
  const availableWidth = Math.max(1, Math.floor(codeBlockWidth))
  const minimumStructuredWidth = 1 + numCols * 4

  if (availableWidth < minimumStructuredWidth) {
    return renderCompactTable(rows, availableWidth, palette, nextKey)
  }

  // Calculate final column widths. One character per cell is the smallest
  // structured representation that still preserves aligned borders.
  const availableForContent = availableWidth - 1 - numCols * 3
  let columnWidths: number[]
  if (totalNaturalWidth <= availableWidth) {
    columnWidths = naturalWidths
  } else {
    const totalNaturalContent = naturalWidths.reduce((a, b) => a + b, 0)
    const scale = availableForContent / totalNaturalContent
    columnWidths = naturalWidths.map((w) => Math.max(1, Math.floor(w * scale)))

    let usedWidth = columnWidths.reduce((a, b) => a + b, 0)
    let remaining = availableForContent - usedWidth
    for (let i = 0; i < columnWidths.length && remaining > 0; i += 1) {
      if (columnWidths[i] < naturalWidths[i]) {
        const add = Math.min(remaining, naturalWidths[i] - columnWidths[i])
        columnWidths[i] += add
        remaining -= add
      }
    }
  }

  // Helper to render a horizontal separator line
  const renderSeparator = (
    leftChar: string,
    midChar: string,
    rightChar: string,
  ): void => {
    let line = leftChar
    columnWidths.forEach((width, idx) => {
      line += '─'.repeat(width + 2) // +2 for padding spaces
      line += idx < columnWidths.length - 1 ? midChar : rightChar
    })
    nodes.push(
      <span key={nextKey()} fg={palette.dividerFg}>
        {line}
      </span>,
    )
    nodes.push('\n')
  }

  // Pre-wrap all cell contents so we know the height of each row
  const wrappedRows: string[][][] = rows.map((row) =>
    Array.from({ length: numCols }, (_, i) => {
      const cellText = row[i] || ''
      return wrapText(cellText, columnWidths[i])
    }),
  )

  // Render top border
  renderSeparator('┌', '┬', '┐')

  // Render each row with word-wrapped cells
  wrappedRows.forEach((wrappedCells, rowIdx) => {
    const isHeader = rowIdx === 0
    const rowHeight = Math.max(...wrappedCells.map((lines) => lines.length), 1)

    // Render each visual line in the row
    for (let lineIdx = 0; lineIdx < rowHeight; lineIdx++) {
      for (let cellIdx = 0; cellIdx < numCols; cellIdx++) {
        const colWidth = columnWidths[cellIdx]
        const lineText = wrappedCells[cellIdx][lineIdx] || ''
        const displayText = padText(lineText, colWidth)

        // Left border for first cell
        if (cellIdx === 0) {
          nodes.push(
            <span key={nextKey()} fg={palette.dividerFg}>
              │
            </span>,
          )
        }

        // Cell content with padding
        nodes.push(
          <span
            key={nextKey()}
            fg={isHeader ? palette.headingFg[3] : undefined}
            attributes={isHeader ? TextAttributes.BOLD : undefined}
          >
            {' '}
            {displayText}{' '}
          </span>,
        )

        // Separator or right border
        nodes.push(
          <span key={nextKey()} fg={palette.dividerFg}>
            │
          </span>,
        )
      }
      nodes.push('\n')
    }

    // Add separator line after header
    if (isHeader) {
      renderSeparator('├', '┼', '┤')
    }
  })

  // Render bottom border. renderSeparator owns the single trailing boundary.
  renderSeparator('└', '┴', '┘')

  return nodes
}

const renderCompactTable = (
  rows: string[][],
  availableWidth: number,
  palette: MarkdownPalette,
  nextKey: () => string,
): ReactNode[] => {
  const nodes: ReactNode[] = []
  if (availableWidth < 5) {
    rows.forEach((row) => {
      const text = row.join(' | ')
      wrapText(text, Math.max(1, availableWidth)).forEach((line) => {
        nodes.push(line, '\n')
      })
    })
    return nodes
  }

  const innerWidth = availableWidth - 4
  const border = (left: string, right: string): void => {
    nodes.push(
      <span key={nextKey()} fg={palette.dividerFg}>
        {`${left}${'─'.repeat(innerWidth + 2)}${right}`}
      </span>,
      '\n',
    )
  }

  const renderCell = (
    label: string,
    value: string,
    isHeader: boolean,
  ): void => {
    const text = isHeader ? value : `${label}: ${value}`
    const lines = wrapText(text, innerWidth)
    lines.forEach((line) => {
      nodes.push(
        <span key={nextKey()} fg={palette.dividerFg}>
          │
        </span>,
        <span
          key={nextKey()}
          fg={isHeader ? palette.headingFg[3] : undefined}
          attributes={isHeader ? TextAttributes.BOLD : undefined}
        >
          {' '}
          {padText(line, innerWidth)}{' '}
        </span>,
        <span key={nextKey()} fg={palette.dividerFg}>
          │
        </span>,
        '\n',
      )
    })
  }

  border('┌', '┐')
  const headers = rows[0] ?? []
  renderCell('', headers.join(' | '), true)
  if (rows.length > 1) {
    border('├', '┤')
  }
  rows.slice(1).forEach((row) => {
    row.forEach((value, index) =>
      renderCell(headers[index] ?? `Column ${index + 1}`, value, false),
    )
  })
  border('└', '┘')
  return nodes
}

export interface StreamingMarkdownBlock {
  key: string
  kind: string
}

/**
 * Returns stable semantic identities for the completed portion of a streaming
 * Markdown document. The identity is based on document order and block kind,
 * not the number of tokens received after the block.
 */
export function getStreamingMarkdownBlockManifest(
  content: string,
): StreamingMarkdownBlock[] {
  try {
    const stableContent = hasIncompleteCodeFence(content)
      ? content.slice(0, content.lastIndexOf('```'))
      : content
    const ast = processor.parse(stableContent) as Root
    return ast.children.map((node, index) => ({
      key: `markdown-block-${index}-${node.type}`,
      kind: node.type,
    }))
  } catch {
    return []
  }
}

const renderNode = (
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
      return renderInlineCode(node as InlineCode, state)

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
      return renderCodeBlock(node as Code, state)

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
      return renderLink(node as Link, state)

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

const normalizeOutput = (nodes: ReactNode[]): ReactNode => {
  const normalized: ReactNode[] = []

  nodes.forEach((node) => {
    if (typeof node === 'string' && /^\s+$/.test(node)) {
      const previous = normalized[normalized.length - 1]
      if (typeof previous === 'string' && /^\s+$/.test(previous)) {
        normalized[normalized.length - 1] = `${previous}${node}`
      } else {
        normalized.push(node)
      }
      return
    }
    normalized.push(node)
  })

  const trimmed = trimTrailingWhitespaceNodes(normalized).filter(
    (node, index) => {
      if (index !== 0 || typeof node !== 'string' || !/^\s+$/.test(node)) {
        return true
      }
      return false
    },
  )

  const compacted = trimmed.map((node) => {
    if (typeof node !== 'string' || !/^\s+$/.test(node)) {
      return node
    }

    const newlineCount = (node.match(/\n/g) ?? []).length
    return newlineCount > 1 ? '\n' : node
  })

  if (compacted.length === 0) {
    return ''
  }
  if (compacted.length === 1) {
    return compacted[0]
  }
  // Preserve semantic block fragments as the reconciliation boundary. A
  // positional wrapper here would make streaming updates reconcile against
  // `markdown-out-*` keys instead of the stable `markdown-block-*` keys.
  return compacted
}

export function renderMarkdown(
  markdown: string,
  options: MarkdownRenderOptions = {},
): ReactNode {
  try {
    const basePalette = options.theme
      ? createMarkdownPalette(options.theme)
      : defaultPalette
    const palette = resolvePalette(basePalette, options.palette)
    const codeBlockWidth = options.codeBlockWidth ?? 80
    const syntaxStyle = options.theme
      ? createSyntaxStyle(options.theme)
      : undefined
    const state = createRenderState(palette, codeBlockWidth, syntaxStyle)
    const ast = processor.parse(markdown) as Root
    applyInlineFallbackFormatting(ast)
    const nodes = renderNode(ast, state, ast.type, undefined)
    return normalizeOutput(nodes)
  } catch (error) {
    logger.error(
      {
        err: error,
        contentLength: markdown.length,
        preview: markdown.slice(0, 200),
      },
      'Failed to parse markdown — returning raw content',
    )
    return markdown
  }
}

export function hasMarkdown(content: string): boolean {
  return /[*_`#>\-\+]|\[.*\]\(.*\)|```/.test(content)
}

export function hasIncompleteCodeFence(content: string): boolean {
  let fenceCount = 0
  const fenceRegex = /```/g
  while (fenceRegex.exec(content)) {
    fenceCount += 1
  }
  return fenceCount % 2 === 1
}

const mergeStreamingSegments = (segments: ReactNode[]): ReactNode => {
  if (segments.length === 0) {
    return ''
  }
  if (segments.length === 1) {
    return segments[0]
  }

  return (
    <>
      <KeyedFragment key="stream-stable-prefix">{segments[0]}</KeyedFragment>
      <KeyedFragment key="stream-pending-region">{segments[1]}</KeyedFragment>
    </>
  )
}

export function renderStreamingMarkdown(
  content: string,
  options: MarkdownRenderOptions = {},
): ReactNode {
  if (!hasMarkdown(content)) {
    return content
  }

  if (!hasIncompleteCodeFence(content)) {
    return renderMarkdown(content, options)
  }

  const lastFenceIndex = content.lastIndexOf('```')
  if (lastFenceIndex === -1) {
    return renderMarkdown(content, options)
  }

  const completeSection = content.slice(0, lastFenceIndex)
  const pendingSection = content.slice(lastFenceIndex)

  const segments: ReactNode[] = []

  if (completeSection.length > 0) {
    segments.push(renderMarkdown(completeSection, options))
  }

  if (pendingSection.length > 0) {
    segments.push(pendingSection)
  }

  return mergeStreamingSegments(segments)
}

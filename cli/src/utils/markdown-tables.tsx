import { TextAttributes } from '@opentui/core'
import React from 'react'
import stringWidth from 'string-width'

import { nodeToPlainText, padText, wrapText } from './markdown-text'

import type { MarkdownPalette, RenderState } from './markdown-types'
import type { Table, TableCell, TableRow } from 'mdast'
import type { ReactNode } from 'react'

export const renderTable = (table: Table, state: RenderState): ReactNode[] => {
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

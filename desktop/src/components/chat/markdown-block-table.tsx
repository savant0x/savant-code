// FID-2026-0819-005 Loop 160: the block-table renderer for MarkdownBlock
// (FID-2026-0901-006 P6 padding semantics), extracted verbatim from
// MarkdownBlock.tsx. A switch-case body cannot be exported as a function
// with the shared RawBlock type without also owning the alignment helpers,
// so the table helpers live here and renderBlockTable is called from the
// switch in MarkdownBlock.tsx.

import { renderInline } from './markdown-inline'

import type { JSX } from 'react'

export type TableColumnAlign = 'left' | 'center' | 'right' | null

export function alignStyle(
  align: TableColumnAlign,
): { textAlign: 'left' | 'center' | 'right' } | undefined {
  return align === null ? undefined : { textAlign: align }
}

type TableBlock = {
  kind: 'table'
  header: string[]
  rows: string[][]
  aligns: TableColumnAlign[]
  key: string
}

export function renderBlockTable(block: TableBlock): JSX.Element {
  // FID-2026-0901-006 P6: a body row may legitimately carry MORE cells
  // than the header (the Thinker's plan tables do). Rendering exactly
  // `header.length` columns silently drops everything past the header,
  // which is why the risk column looked truncated/misaligned. Render the
  // widest column count across header + rows and pad short rows — no data
  // loss, and header alignment still governs the first columns.
  const columnCount = Math.max(
    block.header.length,
    ...block.rows.map((row) => row.length),
    0,
  )
  return (
    <div key={block.key} className="md-table-wrap">
      <table className="md-table">
        <thead>
          <tr>
            {block.header.map((cell, column) => (
              <th
                key={`${block.key}-h${column}`}
                style={alignStyle(block.aligns[column] ?? null)}
              >
                {renderInline(cell, `${block.key}-h${column}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={`${block.key}-r${rowIndex}`}>
              {Array.from({ length: columnCount }, (_, column) => (
                <td
                  key={`${block.key}-r${rowIndex}c${column}`}
                  style={alignStyle(block.aligns[column] ?? null)}
                >
                  {renderInline(
                    row[column] ?? '',
                    `${block.key}-r${rowIndex}c${column}`,
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

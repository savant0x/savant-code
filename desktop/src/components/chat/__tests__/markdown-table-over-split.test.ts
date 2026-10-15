// FID-2026-0901-006 P6 — regression: the Thinker's plan tables carry MORE
// body cells than the header. The renderer previously mapped exactly
// `header.length` columns, silently dropping the trailing cells (the "Risk"
// column lost its tail and the row misaligned). This locks the widest-column
// render so no cell is dropped and short rows pad to the same column count.
//
// Why parse-level alone isn't enough: `parseMarkdown` already stored every
// cell correctly. The bug was purely in `renderBlock`'s table case, so we
// assert on the rendered DOM too.

import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { MarkdownBlock, parseMarkdown } from '../MarkdownBlock'

describe('markdown table with over-long body rows (FID-2026-0901-006 P6)', () => {
  const source = [
    '| Surface | Key Elements | Risk |',
    '| --- | --- | --- |',
    '| CLI Tool | Chat input, panel rows, menu selection | Compatibility with ESM + variable | OpenUSM 5.0.4 |',
    '| Desktop | Chat, server, gates | OpenUSM 5.0.3 |',
  ].join('\n')

  test('parseMarkdown keeps every cell of an over-long row', () => {
    const table = parseMarkdown(source).find((b) => b.kind === 'table')
    expect(table).toBeDefined()
    if (table?.kind === 'table') {
      expect(table.rows[0]).toHaveLength(4)
      expect(table.rows[0][3]).toBe('OpenUSM 5.0.4')
    }
  })

  test('renderBlock renders the widest column count, no trailing data loss', () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownBlock, { text: source }),
    )
    // The 4th cell "OpenUSM 5.0.4" must appear in the rendered table — before
    // the fix, the row (and its trailing cell) was truncated to 3 columns.
    expect(html).toContain('OpenUSM 5.0.4')
    expect(html).toContain('OpenUSM 5.0.3')
    // The threaded renderer must still emit a <table> (not fall through).
    expect(html).toContain('<table')
  })
})

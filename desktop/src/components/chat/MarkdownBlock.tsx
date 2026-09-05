// FID-2026-0820-010 Loop 3 — safe markdown subset renderer for model output.
//
// Security posture (FID Loop 1 Q7): model output is UNTRUSTED content. This
// renderer produces React elements ONLY — there is no HTML string anywhere,
// so injected markup cannot execute (no dangerouslySetInnerHTML; grep-gated).
// Links are scheme-allowlisted to http/https and carry rel=noopener
// noreferrer; every construct outside the supported subset falls through as
// literal text (fail-safe inert). Inline spans live in ./markdown-inline
// (file-ceiling decomposition).

import { memo } from 'react'

import { renderBlockTable } from './markdown-block-table'
import { renderInline } from './markdown-inline'

import type { JSX } from 'react'

const MAX_CODE_CHARS = 20_000

type TableColumnAlign = 'left' | 'center' | 'right' | null
// (alignStyle + the table renderer live in ./markdown-block-table,
// FID-2026-0819-005 Loop 160; the aligns field keeps this local type.)

type RawBlock =
  | { kind: 'heading'; level: number; text: string; key: string }
  | { kind: 'code'; text: string; key: string }
  | { kind: 'list'; ordered: boolean; items: string[]; key: string }
  | { kind: 'quote'; text: string; key: string }
  | {
      kind: 'table'
      header: string[]
      rows: string[][]
      aligns: TableColumnAlign[]
      key: string
    }
  | { kind: 'hr'; key: string }
  | { kind: 'para'; text: string; key: string }

function collectWhile(
  lines: string[],
  start: number,
  pattern: RegExp,
): { captured: string[]; next: number } {
  const captured: string[] = []
  let cursor = start
  while (cursor < lines.length) {
    const match = pattern.exec(lines[cursor])
    if (match === null) break
    captured.push(match[1])
    cursor += 1
  }
  return { captured, next: cursor }
}

const TABLE_ROW = /^\s*\|(.*)\|\s*$/
const TABLE_DIVIDER = /^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/
const HORIZONTAL_RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/

/** Split a pipe-delimited table row into trimmed cells (fail-safe: every
 * pipe separates; escaped pipes are outside the supported subset). */
function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function parseColumnAlign(cell: string): TableColumnAlign {
  const left = cell.startsWith(':')
  const right = cell.endsWith(':')
  if (left && right) return 'center'
  if (right) return 'right'
  if (left) return 'left'
  return null
}

export function parseMarkdown(source: string): RawBlock[] {
  const lines = source.split('\n')
  const blocks: RawBlock[] = []
  let paraLines: string[] = []
  let counter = 0
  const nextKey = (): string => `md-${counter++}`
  const flushPara = (): void => {
    if (paraLines.length > 0) {
      blocks.push({
        kind: 'para',
        text: paraLines.join('\n'),
        key: nextKey(),
      })
      paraLines = []
    }
  }
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (line.trim() === '') {
      flushPara()
      index += 1
      continue
    }
    const fence = /^```(\w*)\s*$/.exec(line)
    if (fence !== null) {
      flushPara()
      const body = collectUntilFence(lines, index + 1)
      index = body.next
      blocks.push({ kind: 'code', text: body.text, key: nextKey() })
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading !== null) {
      flushPara()
      blocks.push({
        kind: 'heading',
        level: heading[1].length,
        text: heading[2],
        key: nextKey(),
      })
      index += 1
      continue
    }
    if (
      TABLE_ROW.test(line) &&
      index + 1 < lines.length &&
      TABLE_DIVIDER.test(lines[index + 1])
    ) {
      flushPara()
      const header = splitTableRow(line)
      const aligns = splitTableRow(lines[index + 1]).map(parseColumnAlign)
      const rows: string[][] = []
      let cursor = index + 2
      while (cursor < lines.length && TABLE_ROW.test(lines[cursor])) {
        rows.push(splitTableRow(lines[cursor]))
        cursor += 1
      }
      blocks.push({ kind: 'table', header, rows, aligns, key: nextKey() })
      index = cursor
      continue
    }
    if (HORIZONTAL_RULE.test(line)) {
      flushPara()
      blocks.push({ kind: 'hr', key: nextKey() })
      index += 1
      continue
    }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    if (bullet !== null) {
      flushPara()
      const collected = collectWhile(lines, index, /^\s*[-*]\s+(.*)$/)
      blocks.push({
        kind: 'list',
        ordered: false,
        items: collected.captured,
        key: nextKey(),
      })
      index = collected.next
      continue
    }
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (ordered !== null) {
      flushPara()
      const collected = collectWhile(lines, index, /^\s*\d+[.)]\s+(.*)$/)
      blocks.push({
        kind: 'list',
        ordered: true,
        items: collected.captured,
        key: nextKey(),
      })
      index = collected.next
      continue
    }
    const quote = /^>\s?(.*)$/.exec(line)
    if (quote !== null) {
      flushPara()
      const collected = collectWhile(lines, index, /^>\s?(.*)$/)
      blocks.push({
        kind: 'quote',
        text: collected.captured.join('\n'),
        key: nextKey(),
      })
      index = collected.next
      continue
    }
    paraLines.push(line)
    index += 1
  }
  flushPara()
  return blocks
}

function collectUntilFence(
  lines: string[],
  start: number,
): { text: string; next: number } {
  const body: string[] = []
  let cursor = start
  while (cursor < lines.length && /^```\s*$/.test(lines[cursor]) === false) {
    body.push(lines[cursor])
    cursor += 1
  }
  // Step past the closing fence when present (EOF without one still parses).
  const next = cursor < lines.length ? cursor + 1 : cursor
  let text = body.join('\n')
  if (text.length > MAX_CODE_CHARS) {
    text = `${text.slice(0, MAX_CODE_CHARS)}…`
  }
  return { text, next }
}

function renderBlock(block: RawBlock): JSX.Element {
  switch (block.kind) {
    case 'heading': {
      const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
      return (
        <Tag key={block.key} className="md-heading">
          {renderInline(block.text, block.key)}
        </Tag>
      )
    }
    case 'code':
      return (
        <pre key={block.key} className="md-code">
          <code>{block.text}</code>
        </pre>
      )
    case 'list': {
      const ListTag = block.ordered ? 'ol' : 'ul'
      return (
        <ListTag key={block.key} className="md-list">
          {block.items.map((item, itemIndex) => (
            <li key={`${block.key}-${itemIndex}`}>
              {renderInline(item, `${block.key}-${itemIndex}`)}
            </li>
          ))}
        </ListTag>
      )
    }
    case 'quote':
      return (
        <blockquote key={block.key} className="md-quote">
          {renderInline(block.text, block.key)}
        </blockquote>
      )
    case 'hr':
      return <hr key={block.key} className="md-hr" />
    case 'table':
      // Table rendering extracted verbatim to markdown-block-table.tsx
      // (FID-2026-0819-005 Loop 160; FID-2026-0901-006 P6 padding comment
      // lives there).
      return renderBlockTable(block)
    case 'para':
      return (
        <p key={block.key} className="md-p">
          {renderInline(block.text, block.key)}
        </p>
      )
  }
}

export const MarkdownBlock = memo(function MarkdownBlock({
  text,
}: {
  text: string
}): JSX.Element {
  const blocks = parseMarkdown(text)
  return <div className="md">{blocks.map(renderBlock)}</div>
})

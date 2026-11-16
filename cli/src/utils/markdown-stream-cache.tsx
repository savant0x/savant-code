/**
 * Incremental render cache for a streaming markdown document.
 *
 * The streaming text path used to re-parse and re-render the whole message on
 * every flush (FID-2026-1030-006). This cache freezes a proven-safe prefix —
 * a position after a blank line where no markdown construct is open — and only
 * renders the text that arrived since. Rendering chunk N at a blank-line
 * boundary is byte-equivalent to one full render because every top-level block
 * carries its own trailing newline inside its fragment, so the concatenation
 * keeps the exact separators of the whole-document render.
 *
 * Correctness rules:
 *
 *   - A boundary is chosen conservatively. Whenever the scanner is unsure it
 *     reports `-1` and the caller renders the whole document without touching
 *     the cache. A wrong split is worse than a slow frame.
 *   - Every chunk is rendered with a continuing `blockIndexOffset` and its own
 *     `keyPrefix`, so concatenated chunks share one unique key space.
 *   - Width, palette identity or theme identity changes drop the cache; content
 *     that is not a prefix extension drops it too.
 */

import { renderMarkdownWithMeta } from './markdown-renderer'

import type { RenderedMarkdownChunk } from './markdown-renderer'
import type { MarkdownPalette, MarkdownRenderOptions } from './markdown-types'
import type { ReactNode } from 'react'

/**
 * When no safe boundary exists, a long unpromising tail is split at the last
 * blank line anyway. Splitting inside a construct can re-render it, which is a
 * visual cost bounded to one flush; the cost this avoids is re-rendering the
 * whole document forever. The rule never splits a document that has no newline.
 */
export const STREAM_RELAX_AFTER = 8000

const FENCE_LINE = /^ {0,3}(?:```|~~~)/
const LIST_ITEM = /^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:\s|$)/
const BLOCKQUOTE = /^ {0,3}>/
const SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+)\s*$/
const INDENTED_CODE = /^(?:\t| {4})/

export interface StreamBoundary {
  /** Absolute index just after the blank-line run, or -1 when none is safe. */
  index: number
  /** Fence parity accumulated through the scanned region. */
  fenceCount: number
}

/** Number of fenced-code delimiter lines in `text`. */
export function countFenceLines(text: string): number {
  let count = 0
  let start = 0
  while (start <= text.length) {
    const newline = text.indexOf('\n', start)
    const line = newline === -1 ? text.slice(start) : text.slice(start, newline)
    if (FENCE_LINE.test(line)) count += 1
    if (newline === -1) break
    start = newline + 1
  }
  return count
}

/**
 * A blank line is a safe chunk boundary only when the line before it and the
 * line after it cannot be part of the same block. Lists continue across blank
 * lines (loose lists), blockquotes merge, tables keep their row group, and
 * indented lines continue the previous construct or open an indented code
 * block. Pipes and list markers are rejected conservatively: a false negative
 * costs a full render, a false positive corrupts the transcript.
 */
function isSafeSplitPoint(
  previousLine: string,
  nextLine: string,
): boolean {
  if (nextLine.trim() === '') return false
  if (previousLine === '') return true
  if (FENCE_LINE.test(previousLine) || FENCE_LINE.test(nextLine)) return true
  if (BLOCKQUOTE.test(previousLine) || BLOCKQUOTE.test(nextLine)) return false
  if (LIST_ITEM.test(previousLine) || LIST_ITEM.test(nextLine)) return false
  if (INDENTED_CODE.test(previousLine) || INDENTED_CODE.test(nextLine)) {
    return false
  }
  if (SETEXT_UNDERLINE.test(nextLine)) return false
  if (previousLine.includes('|') || nextLine.includes('|')) return false
  return true
}

/**
 * Find the farthest safe chunk boundary at or after `from`.
 *
 * The farthest candidate matters: freezing one block per flush would leave the
 * whole remaining tail to re-render every time, which is the cost this cache
 * exists to remove. `fenceCount` is the fence parity at `from`; the scan
 * maintains it forward, so repeated calls cost the delta only. A blank line
 * inside a fenced code block is not a candidate.
 */
export function findSafeBoundary(
  content: string,
  from: number,
  fenceCount: number,
  relaxAfter = STREAM_RELAX_AFTER,
): StreamBoundary {
  let start = Math.max(0, from)
  let fences = fenceCount
  let previousLine = from === 0 ? '' : lastLineBefore(content, start)
  let best: StreamBoundary | null = null
  let relaxed: StreamBoundary | null = null

  while (start <= content.length) {
    const newline = content.indexOf('\n', start)
    if (newline === -1) break
    const line = content.slice(start, newline)
    if (FENCE_LINE.test(line)) fences += 1

    if (line.trim() === '') {
      let next = newline
      while (next < content.length && content[next] === '\n') next += 1
      if (next >= content.length) break
      const nextNewline = content.indexOf('\n', next)
      const nextLine =
        nextNewline === -1 ? content.slice(next) : content.slice(next, nextNewline)
      const candidate: StreamBoundary = { index: next, fenceCount: fences }
      if (fences % 2 === 0) {
        if (isSafeSplitPoint(previousLine, nextLine)) best = candidate
        relaxed = candidate
      }
      start = next
      continue
    }

    if (line.trim() !== '') previousLine = line
    start = newline + 1
  }

  if (best) return best
  if (relaxed && content.length - from > relaxAfter) return relaxed
  return { index: -1, fenceCount: fences }
}

/** Last non-blank line that ends before `index`. */
function lastLineBefore(content: string, index: number): string {
  let end = index
  while (end > 0) {
    const start = content.lastIndexOf('\n', end - 2) + 1
    const line = content.slice(start, end)
    if (line.trim() !== '') return line
    end = start
  }
  return ''
}

export interface MarkdownStreamCacheStats {
  /** Render calls made (full renders plus chunk/tail renders). */
  renders: number
  /** Characters handed to the renderer in total. */
  renderedChars: number
  /** Cache drops caused by width/palette/theme/non-prefix content. */
  resets: number
  /** Full documents that were split into a frozen prefix plus a tail. */
  seeded: number
  /** Calls served from a frozen prefix. */
  hits: number
}

/** Injected renderer seam — dependency injection over module mocking. */
export type MarkdownChunkRenderer = (
  source: string,
  options: MarkdownRenderOptions,
) => RenderedMarkdownChunk

interface FrozenPrefix {
  width: number
  palette: Partial<MarkdownPalette> | null
  theme: MarkdownRenderOptions['theme'] | null
  source: string
  nodes: ReactNode[]
  blocks: number
  fences: number
  generation: number
}

const toArray = (nodes: ReactNode): ReactNode[] => {
  if (nodes === null || nodes === undefined || nodes === false || nodes === '') {
    return []
  }
  return Array.isArray(nodes) ? nodes : [nodes]
}

const toNode = (nodes: ReactNode[]): ReactNode => {
  if (nodes.length === 0) return ''
  if (nodes.length === 1) return nodes[0]
  return nodes
}

export class MarkdownStreamCache {
  private readonly renderChunk: MarkdownChunkRenderer
  private frozen: FrozenPrefix | null = null
  private generation = 0
  private chunkSerial = 0
  private counters: MarkdownStreamCacheStats = {
    renders: 0,
    renderedChars: 0,
    resets: 0,
    seeded: 0,
    hits: 0,
  }

  constructor(renderChunk: MarkdownChunkRenderer = renderMarkdownWithMeta) {
    this.renderChunk = renderChunk
  }

  get stats(): MarkdownStreamCacheStats {
    return { ...this.counters }
  }

  /** Drop the frozen prefix; the next render is a full one. */
  reset(): void {
    this.frozen = null
    this.counters.resets += 1
  }

  /**
   * Render `content`, reusing the frozen prefix when it is still a prefix at
   * the same width, palette and theme. Falls back to a full render whenever the
   * cache cannot prove it is safe.
   */
  renderContent(
    content: string,
    options: MarkdownRenderOptions = {},
  ): ReactNode {
    const width = options.codeBlockWidth ?? 80
    const palette = options.palette ?? null
    const theme = options.theme ?? null
    const frozen = this.frozen

    if (
      !frozen ||
      frozen.width !== width ||
      frozen.palette !== palette ||
      frozen.theme !== theme ||
      !content.startsWith(frozen.source)
    ) {
      if (frozen) this.counters.resets += 1
      return this.seed(content, options, width, palette, theme)
    }

    this.counters.hits += 1

    const boundary = findSafeBoundary(
      content,
      frozen.source.length,
      frozen.fences,
    )
    if (boundary.index > frozen.source.length) {
      const chunkSource = content.slice(frozen.source.length, boundary.index)
      const chunk = this.callRender(
        chunkSource,
        options,
        frozen.blocks,
        `md${frozen.generation}c${this.chunkSerial++}`,
      )
      frozen.nodes.push(...toArray(chunk.nodes))
      frozen.blocks += chunk.blockCount
      frozen.fences = boundary.fenceCount
      frozen.source = content.slice(0, boundary.index)
    }

    const tailSource = content.slice(frozen.source.length)
    if (tailSource === '') return toNode(frozen.nodes)
    const tail = this.callRender(
      tailSource,
      options,
      frozen.blocks,
      `md${frozen.generation}t`,
    )
    return [...frozen.nodes, ...toArray(tail.nodes)]
  }

  private seed(
    content: string,
    options: MarkdownRenderOptions,
    width: number,
    palette: Partial<MarkdownPalette> | null,
    theme: MarkdownRenderOptions['theme'] | null,
  ): ReactNode {
    this.generation += 1
    this.chunkSerial = 0
    const boundary = findSafeBoundary(content, 0, 0)

    // No proven boundary: render the whole document and freeze nothing. The
    // next call pays a full render again, which is the honest cost of not
    // knowing a safe place to split.
    if (boundary.index <= 0) {
      return this.callRender(
        content,
        options,
        0,
        `md${this.generation}w`,
      ).nodes
    }

    const headSource = content.slice(0, boundary.index)
    const head = this.callRender(
      headSource,
      options,
      0,
      `md${this.generation}h`,
    )
    this.frozen = {
      width,
      palette,
      theme,
      source: headSource,
      nodes: toArray(head.nodes),
      blocks: head.blockCount,
      fences: boundary.fenceCount,
      generation: this.generation,
    }
    this.counters.seeded += 1

    const tailSource = content.slice(boundary.index)
    if (tailSource === '') return toNode(this.frozen.nodes)
    const tail = this.callRender(
      tailSource,
      options,
      head.blockCount,
      `md${this.generation}t`,
    )
    return [...this.frozen.nodes, ...toArray(tail.nodes)]
  }

  private callRender(
    source: string,
    options: MarkdownRenderOptions,
    blockIndexOffset: number,
    keyPrefix: string,
  ): RenderedMarkdownChunk {
    this.counters.renders += 1
    this.counters.renderedChars += source.length
    return this.renderChunk(source, { ...options, blockIndexOffset, keyPrefix })
  }
}

import stringWidth from 'string-width'

// Keep measurement logic centralised so components can share consistent wrap behavior.
function measureLines(text: string, cols: number): number {
  if (text.length === 0) return 1

  let lines = 1
  let current = 0
  const tokens = text.split(/(\s+)/)

  const emitHardWrap = () => {
    lines += 1
    current = 0
  }

  const appendSegment = (
    segment: string,
    { flushBeforeOversize = true }: { flushBeforeOversize?: boolean } = {},
  ) => {
    if (!segment) return

    const segmentWidth = stringWidth(segment)
    if (segmentWidth > cols) {
      if (flushBeforeOversize && current > 0) emitHardWrap()
      let acc = 0
      for (const ch of Array.from(segment)) {
        const w = stringWidth(ch)
        if (acc + w > cols) {
          emitHardWrap()
          acc = 0
        }
        acc += w
      }
      current = acc
      return
    }

    if (current + segmentWidth > cols) emitHardWrap()
    current += segmentWidth
  }

  for (const token of tokens) {
    if (!token) continue

    if (token.includes('\n')) {
      const parts = token.split('\n')
      for (let i = 0; i < parts.length; i++) {
        appendSegment(parts[i], { flushBeforeOversize: false })
        if (i < parts.length - 1) emitHardWrap()
      }
      continue
    }

    appendSegment(token)
  }

  return lines
}

export interface GetLastNVisualLinesOptions {
  /**
   * FID-2026-0822-010: when an oversize token is char-split and a row ends
   * mid-word, trim that row back to the last word boundary and append an
   * ellipsis marker ('…') so no word is ever clipped flush against a panel
   * border without a visible truncation indicator. Defaults to false — the
   * terminal-status gutter slice path relies on exact-width hard slices.
   */
  ellipsizeMidWordCuts?: boolean
}

export function getLastNVisualLines(
  text: string,
  cols: number,
  n: number,
  options: GetLastNVisualLinesOptions = {},
): { lines: string[]; hasMore: boolean } {
  const { ellipsizeMidWordCuts = false } = options
  if (n <= 0 || cols <= 0) return { lines: [], hasMore: false }
  const lines: string[] = []
  if (!text) return { lines, hasMore: false }

  // Trim a char-split row back to the last word boundary and mark the cut —
  // but only when the row actually ends mid-word. A char-split row ends on a
  // word character (the oversize token continues); a clean word-boundary
  // wrap ends on whitespace or punctuation and must stay untouched.
  const ellipsizeMidWordRow = (line: string): string => {
    const trimmed = line.trimEnd()
    if (trimmed.length === 0) return trimmed
    const lastChar = Array.from(trimmed).at(-1)!
    if (!/[\p{L}\p{N}]/u.test(lastChar)) return trimmed
    const lastWhitespace = trimmed.search(/\s+\S*$/)
    if (lastWhitespace === -1) {
      // Single unbroken fragment — keep a marker on the cut.
      return trimmed.length > 1 ? `${trimmed.slice(0, -1)}…` : '…'
    }
    return `${trimmed.slice(0, lastWhitespace).trimEnd()}…`
  }

  const tokens = text.split(/(\s+)/)
  let current = ''
  let currentWidth = 0

  const pushLine = () => {
    lines.push(current)
    current = ''
    currentWidth = 0
  }

  const appendSegment = (segment: string) => {
    if (!segment) return
    const segWidth = stringWidth(segment)

    if (segWidth > cols) {
      for (const ch of Array.from(segment)) {
        const w = stringWidth(ch)
        if (currentWidth + w > cols) {
          if (ellipsizeMidWordCuts) {
            current = ellipsizeMidWordRow(current)
          }
          pushLine()
        }
        current += ch
        currentWidth += w
      }
      return
    }

    if (currentWidth + segWidth > cols) pushLine()
    current += segment
    currentWidth += segWidth
  }

  for (const token of tokens) {
    if (!token) continue
    if (token.includes('\n')) {
      const parts = token.split('\n')
      for (let i = 0; i < parts.length; i++) {
        appendSegment(parts[i])
        if (i < parts.length - 1) pushLine()
      }
      continue
    }
    appendSegment(token)
  }

  if (current.length > 0 || lines.length === 0) pushLine()
  const hasMore = lines.length > n
  const lastLines = lines.slice(-n)
  return { lines: lastLines, hasMore }
}

export function computeInputLayoutMetrics({
  layoutContent,
  cursorProbe,
  cols,
  maxHeight,
  minHeight = 1,
}: {
  layoutContent: string
  cursorProbe: string
  cols: number
  maxHeight: number
  minHeight?: number
}): { heightLines: number; gutterEnabled: boolean } {
  const safeMaxHeight = Math.max(1, maxHeight)
  const effectiveMinHeight = Math.max(
    1,
    Math.min(minHeight ?? 1, safeMaxHeight),
  )
  const totalLines = measureLines(layoutContent, cols)
  const cursorLines = measureLines(cursorProbe, cols)

  // Add bottom gutter when cursor is on line 2 of exactly 2 lines
  const gutterEnabled =
    totalLines === 2 && cursorLines === 2 && totalLines + 1 <= safeMaxHeight

  const rawHeight = Math.min(
    totalLines + (gutterEnabled ? 1 : 0),
    safeMaxHeight,
  )

  const heightLines = Math.max(effectiveMinHeight, rawHeight)

  return {
    heightLines,
    gutterEnabled,
  }
}

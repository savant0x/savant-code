import type { LineInfo } from './types'

export type LayoutMetrics = {
  heightLines: number
  gutterEnabled: boolean
  isScrollable: boolean
}

export function computeLayoutMetrics(opts: {
  lineInfo: LineInfo | null
  cursorRow: number
  maxHeight: number
  minHeight: number
}): LayoutMetrics {
  const { lineInfo, cursorRow, maxHeight, minHeight } = opts
  const safeMaxHeight = Math.max(1, maxHeight)
  const effectiveMinHeight = Math.max(1, Math.min(minHeight, safeMaxHeight))

  const totalLines = lineInfo === null ? 0 : lineInfo.lineStartCols.length

  // Add bottom gutter when cursor is on line 2 of exactly 2 lines
  const gutterEnabled =
    totalLines === 2 && cursorRow === 1 && totalLines + 1 <= safeMaxHeight

  const rawHeight = Math.min(
    totalLines + (gutterEnabled ? 1 : 0),
    safeMaxHeight,
  )

  const heightLines = Math.max(effectiveMinHeight, rawHeight)

  // Content is scrollable when total lines exceed max height
  const isScrollable = totalLines > safeMaxHeight

  return {
    heightLines,
    gutterEnabled,
    isScrollable,
  }
}

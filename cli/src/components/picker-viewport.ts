export const PICKER_RESERVED_TERMINAL_ROWS = 10
export const PICKER_MAX_VISIBLE_ROWS = 12

export interface PickerViewport {
  visibleRows: number
  needsScroll: boolean
  start: number
  end: number
}

/**
 * Derive a bounded picker viewport from the terminal budget.
 *
 * The reserved rows cover the picker frame, title/footer affordances, cwd
 * line, input, and the surrounding bottom-panel chrome. A picker may render
 * fewer rows than the logical catalog, but it never truncates the catalog.
 */
export function getPickerViewport(
  terminalHeight: number,
  totalRows: number,
  selectedIndex = 0,
  maxVisibleRows = PICKER_MAX_VISIBLE_ROWS,
  reservedRows = PICKER_RESERVED_TERMINAL_ROWS,
): PickerViewport {
  const safeHeight = Number.isFinite(terminalHeight)
    ? Math.max(1, Math.floor(terminalHeight))
    : Number.MAX_SAFE_INTEGER
  const safeTotalRows = Number.isFinite(totalRows)
    ? Math.max(0, Math.floor(totalRows))
    : 0
  const safeMaxVisibleRows = Number.isFinite(maxVisibleRows)
    ? Math.max(1, Math.floor(maxVisibleRows))
    : PICKER_MAX_VISIBLE_ROWS
  const safeReservedRows = Number.isFinite(reservedRows)
    ? Math.max(0, Math.floor(reservedRows))
    : PICKER_RESERVED_TERMINAL_ROWS
  const availableRows = Math.max(1, safeHeight - safeReservedRows)
  const visibleRows = Math.min(
    safeMaxVisibleRows,
    availableRows,
    Math.max(safeTotalRows, 1),
  )
  const maxStart = Math.max(safeTotalRows - visibleRows, 0)
  const safeSelectedIndex = Number.isFinite(selectedIndex)
    ? Math.max(
        0,
        Math.min(Math.floor(selectedIndex), Math.max(safeTotalRows - 1, 0)),
      )
    : 0
  const idealStart = safeSelectedIndex - Math.floor((visibleRows - 1) / 2)
  const start = Math.max(0, Math.min(idealStart, maxStart))

  return {
    visibleRows,
    needsScroll: safeTotalRows > visibleRows,
    start,
    end: Math.min(start + visibleRows, safeTotalRows),
  }
}

export function normalizeSelectableIndex(
  selectedIndex: number,
  totalRows: number,
  isSelectable: (index: number) => boolean,
): number {
  const safeTotalRows = Math.max(0, Math.floor(totalRows))
  if (safeTotalRows === 0) return 0

  const safeIndex = Number.isFinite(selectedIndex)
    ? Math.max(0, Math.min(Math.floor(selectedIndex), safeTotalRows - 1))
    : 0
  if (isSelectable(safeIndex)) return safeIndex

  for (let offset = 1; offset < safeTotalRows; offset++) {
    const next = (safeIndex + offset) % safeTotalRows
    if (isSelectable(next)) return next
  }
  return 0
}

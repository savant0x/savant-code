// FID-2026-0820-010 Step 4 — pure unified-diff line classifier. Zero React
// imports: this module is independently unit-tested and reusable. parseDiff
// returns null when the text carries no +/- rows, so callers fall back to
// plain rendering instead of mislabeling ordinary tool output as a diff.

export type DiffRowType = 'meta' | 'hunk' | 'add' | 'remove' | 'context'

export interface DiffRow {
  type: DiffRowType
  text: string
}

/** Render ceiling for one diff view; overflow collapses into a meta row. */
export const MAX_DIFF_ROWS = 2000

function classifyLine(line: string): DiffRowType {
  if (
    line.startsWith('+++') ||
    line.startsWith('---') ||
    line.startsWith('diff ') ||
    line.startsWith('index ')
  ) {
    return 'meta'
  }
  if (line.startsWith('@@')) return 'hunk'
  if (line.startsWith('+')) return 'add'
  if (line.startsWith('-')) return 'remove'
  return 'context'
}

/**
 * Classify each line of a textual diff into tintable row kinds.
 * Returns null when the text contains neither add nor remove rows (or is
 * empty) — i.e. it is not a diff. Output is capped at MAX_DIFF_ROWS with a
 * trailing meta row counting the omitted tail.
 */
export function parseDiff(text: string): DiffRow[] | null {
  if (text.length === 0) return null
  const lines = text.split('\n')
  // A trailing newline splits into a phantom empty final element — drop it.
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  const rows: DiffRow[] = lines.map((line) => ({
    type: classifyLine(line),
    text: line,
  }))
  const isDiff = rows.some((row) => row.type === 'add' || row.type === 'remove')
  if (!isDiff) return null
  if (rows.length <= MAX_DIFF_ROWS) return rows
  const omitted = rows.length - MAX_DIFF_ROWS
  return [
    ...rows.slice(0, MAX_DIFF_ROWS),
    { type: 'meta', text: `… ${omitted} more lines` },
  ]
}

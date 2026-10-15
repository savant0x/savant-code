/**
 * LF-001 (FID-2026-1012-007) — exact line-window extraction for `read_files`.
 *
 * The window MUST be applied while the content is still complete. The SDK's
 * fetch boundary truncates at `READ_FILES_MAX_CHARS`, so a window applied
 * afterwards can only ever see that prefix: `LEARNINGS.md` has 2,147 lines
 * but its 100k-character prefix holds 1,552, and an `offset` of 1,750
 * therefore returned empty even though the lines existed. Both the SDK fetch
 * boundary and the runtime's embedded-bundle reads slice through this one
 * function so the two can never drift.
 *
 * Boundaries are newline-exact: a window that ends before EOF keeps the
 * separator that lines it up with the next window, so consecutive paginated
 * reads concatenate back to the original content byte-for-byte. `offset` is
 * 1-indexed; an offset past EOF returns an empty string rather than
 * fabricating lines.
 */
export function extractLineWindow(
  content: string,
  offset?: number,
  limit?: number,
): string {
  if (offset === undefined && limit === undefined) return content
  const lines = content.split('\n')
  const start = Math.max((offset ?? 1) - 1, 0)
  if (start >= lines.length) return ''
  const end = limit === undefined ? lines.length : start + limit
  const window = lines.slice(start, end)
  if (window.length === 0) return ''
  // Reaching EOF keeps the file's own trailing newline (the empty final
  // element); stopping mid-file must keep the separator its successor starts
  // from, or the concatenated pages lose a byte per page boundary.
  return end >= lines.length ? window.join('\n') : `${window.join('\n')}\n`
}

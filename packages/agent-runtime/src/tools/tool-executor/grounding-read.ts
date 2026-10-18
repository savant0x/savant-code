import {
  BOOT_LEARNINGS_MAX_CHARACTERS,
  BOOT_LEARNINGS_PATH,
} from '@savant-code/common/constants/learnings-boot'
import { HIDDEN_FILE_READ_STATUS } from '@savant-code/common/old-constants'

import { normalizeGroundingPath } from '../../echo/grounding'

import type { ToolMessage } from '@savant-code/common/types/messages/savant-code-message'

/** The line window requested for the read that produced the response. */
export interface ReadLineWindow {
  offset?: number
  limit?: number
}

export function countRenderedLines(content: string): number {
  if (content.length === 0) return 0
  const lines = content.split('\n')
  return content.endsWith('\n') ? lines.length - 1 : lines.length
}

/**
 * Whether the returned text is provably a PARTIAL window of the file.
 *
 * FID-2026-1018-009: the window used to be detected by key presence
 * (`'limit' in input`), so the model's `read_files` on `ECHO.md` with a
 * generous cap — `limit: 2000` on a 923-line file — returned the whole file
 * and still earned no grounding credit. That left the required set
 * permanently incomplete: the session-init gate blocked the loop, the
 * completion gate retried three times, disarmed, and the turn ended with no
 * tool call. The window's EFFECT decides now:
 *
 * - an `offset` past line 1 always starts mid-file;
 * - a `limit` only partitions the file when the response used it up. A slice
 *   shorter than the limit provably reached EOF, because
 *   `extractLineWindow` returns the file's own tail once the range runs past
 *   it.
 *
 * Documented conservative edge: when the file's line count equals the limit
 * exactly, the returned text is byte-identical to a truncated window and the
 * read keeps its previous no-credit verdict. Credit stays unavailable only
 * for a read that looks partial; it is never granted on a partial one.
 */
export function windowIsPartial(
  content: string,
  lineWindow: ReadLineWindow,
): boolean {
  if (lineWindow.offset !== undefined && lineWindow.offset > 1) return true
  if (lineWindow.limit === undefined) return false
  return countRenderedLines(content) >= lineWindow.limit
}

/** Read the requested line window from a tool call's input, ignoring junk. */
export function readLineWindow(input: unknown): ReadLineWindow {
  const record =
    input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const line = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined
  return { offset: line(record.offset), limit: line(record.limit) }
}

/** A response can carry useful partial text without completing session grounding. */
export function completeGroundingReads(params: {
  output: ToolMessage['content']
  lineWindow: ReadLineWindow
}): Array<{ path: string; characters: number; bytes: number }> {
  return params.output.flatMap((part) => {
    if (part.type !== 'json' || !Array.isArray(part.value)) return []
    return part.value.flatMap((entry) => {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        Array.isArray(entry) ||
        !('path' in entry) ||
        typeof entry.path !== 'string' ||
        !('content' in entry) ||
        typeof entry.content !== 'string' ||
        !entry.content.trim() ||
        ('contentOmittedForLength' in entry &&
          entry.contentOmittedForLength === true) ||
        /\[FILE_TOO_LARGE:|\[.*TRUNCATED.*\]/i.test(entry.content) ||
        windowIsPartial(entry.content, params.lineWindow)
      )
        return []
      const content = entry.content
      if (HIDDEN_FILE_READ_STATUS.some((status) => content.startsWith(status)))
        return []
      const normalized = normalizeGroundingPath(entry.path)
      if (
        (normalized === BOOT_LEARNINGS_PATH ||
          normalized.endsWith(`/${BOOT_LEARNINGS_PATH}`)) &&
        content.length > BOOT_LEARNINGS_MAX_CHARACTERS
      )
        return []
      return [
        {
          path: entry.path,
          characters: entry.content.length,
          bytes: Buffer.byteLength(entry.content, 'utf8'),
        },
      ]
    })
  })
}

import { CompactionMessage_ } from './phases'

import type { Message } from '@savant-code/common/types/messages/savant-code-message'

/**
 * FID-2026-1006-002 WP5 (T149 #5): compaction cut points.
 *
 * Pure planning module — no clock, no I/O, no logger (WP8 pure-decision
 * convention). The token estimator and budget are injected by the caller.
 *
 * Two hard rules from the FID:
 * 1. **Never cut at a tool result.** A cut boundary whose kept region opens
 *    on a `tool` message orphans that result from its tool-call (or splits a
 *    call/result pair). `isIllegalCut` pins this; `findCutPoint` never
 *    returns an illegal boundary.
 * 2. **A turn over budget splits into two summaries that merge.** When the
 *    boundary turn is itself over the summary budget, keeping it live would
 *    defeat the compaction; instead the turn is split at a legal intra-turn
 *    index, each half is summarized separately, and the two summaries merge
 *    (`mergeSplitSummaries`).
 *
 * Repeated compaction re-summarizes from the PREVIOUS KEPT BOUNDARY, not
 * from the previous compaction entry: the caller passes `windowStart`
 * (typically `CompactionMessage_.findPreviousKeptBoundary(messages)`), and
 * every plan segment starts at or after it — already-summarized content is
 * never re-summarized.
 */

/** Half-open message-index range `[start, end)`. */
export interface TurnSpan {
  start: number
  end: number
}

/** One summary segment: the caller summarizes messages[start..end) separately. */
export interface CutSegment {
  start: number
  end: number
}

export interface CutPlan {
  /**
   * First LIVE (kept) message index — everything at or after it stays
   * verbatim. Never sits on an illegal boundary (never at a tool result).
   */
  cutIndex: number
  /**
   * Disjoint summary segments covering `[windowStart, cutIndex)` in order.
   * Exactly one segment normally; two when the boundary turn was over budget
   * and split (the two summaries merge).
   */
  segments: CutSegment[]
  /** True when the boundary moved from the requested preferredIndex. */
  adjusted: boolean
  /**
   * Present when the boundary turn was over budget and was split into the
   * two trailing summary segments.
   */
  splitTurn?: { start: number; end: number; splitAt: number }
}

/**
 * Group messages into conversational turns: each user message starts a new
 * turn; assistant and tool messages belong to the turn of the preceding user
 * message. Leading assistant/tool messages (before the first user message —
 * e.g. a window opened mid-turn after a previous compaction) form a
 * synthetic first turn starting at index 0, which keeps them from being
 * orphaned by the first legal cut.
 */
export function segmentTurns(messages: Message[]): TurnSpan[] {
  const turns: TurnSpan[] = []
  let start = 0
  for (let i = 1; i < messages.length; i++) {
    if (messages[i].role === 'user') {
      turns.push({ start, end: i })
      start = i
    }
  }
  turns.push({ start, end: messages.length })
  return turns
}

/**
 * A cut at `index` is illegal when the kept region `[index, end)` opens on a
 * tool result — that result's tool-call lives in the summarized region (or in
 * a prior compaction), leaving an orphaned result in the live context. This
 * single rule also covers splitting an adjacent call/result pair, because
 * results always follow their calls in the array.
 */
export function isIllegalCut(messages: Message[], index: number): boolean {
  if (index <= 0 || index >= messages.length) return false
  return messages[index].role === 'tool'
}

function turnContaining(turns: TurnSpan[], index: number): TurnSpan {
  for (const turn of turns) {
    if (index >= turn.start && index < turn.end) return turn
  }
  return turns[turns.length - 1]
}

function tokensOf(
  messages: Message[],
  start: number,
  end: number,
  estimateTokens: (message: Message) => number,
): number {
  let total = 0
  for (let i = start; i < end; i++) total += estimateTokens(messages[i])
  return total
}

/**
 * Nearest index to `target` (inclusive bounds) that is a legal split point:
 * strictly inside `[min, max)`, never illegal (`isIllegalCut`). Returns null
 * when no legal index exists in the range.
 */
function nearestLegalSplit(
  messages: Message[],
  target: number,
  min: number,
  max: number,
): number | null {
  const inRange = (index: number): boolean => index >= min && index < max
  for (let offset = 0; offset < messages.length; offset++) {
    const down = target - offset
    if (inRange(down) && !isIllegalCut(messages, down)) return down
    const up = target + offset
    if (inRange(up) && !isIllegalCut(messages, up)) return up
    if (down < min && up >= max) break
  }
  return null
}

/**
 * Plan the compaction cut for the summarized window `[windowStart, cutIndex)`.
 *
 * - The cut moves back to the start of the turn containing the preferred
 *   index (clamped to `windowStart`), so the boundary turn stays live whole.
 * - If that boundary turn's live-eligible span is itself over
 *   `budgetTokens`, the turn is instead summarized: the plan splits it at
 *   the legal intra-turn index nearest its midpoint, `cutIndex` moves past
 *   the turn's end, and the two trailing segments summarize separately and
 *   merge into one summary.
 */
export function findCutPoint(params: {
  messages: Message[]
  /** Requested boundary: `[windowStart, preferredIndex)` summarizes. */
  preferredIndex: number
  /** Token budget governing whether the boundary turn must split. */
  budgetTokens: number
  /** Injected pure token estimator (WP8: no clock, no I/O). */
  estimateTokens: (message: Message) => number
  /**
   * The previous compaction's kept boundary (see
   * `CompactionMessage_.findPreviousKeptBoundary`). Defaults to 0.
   */
  windowStart?: number
}): CutPlan {
  const { messages, budgetTokens, estimateTokens } = params
  const windowStart = Math.min(
    Math.max(0, Math.floor(params.windowStart ?? 0)),
    messages.length,
  )

  // Degenerate window: the previous kept boundary sits at or past the array
  // end — there is nothing in this window left to summarize.
  if (windowStart >= messages.length) {
    return {
      cutIndex: messages.length,
      segments: [],
      adjusted: params.preferredIndex !== messages.length,
    }
  }

  const preferred = Math.min(
    Math.max(params.preferredIndex, windowStart + 1),
    messages.length,
  )

  const turns = segmentTurns(messages)
  const boundaryTurn =
    preferred === messages.length
      ? turns[turns.length - 1]
      : turnContaining(turns, preferred)

  // Live-eligible span of the boundary turn (never summarize before the
  // previous kept boundary — repeated compaction starts there).
  const spanStart = Math.max(boundaryTurn.start, windowStart)
  const spanEnd = boundaryTurn.end

  const spanTokens = tokensOf(messages, spanStart, spanEnd, estimateTokens)
  const overBudget = spanTokens > budgetTokens && spanEnd - spanStart >= 2

  if (overBudget) {
    const midpoint = spanStart + Math.floor((spanEnd - spanStart) / 2)
    const splitAt = nearestLegalSplit(
      messages,
      midpoint,
      spanStart + 1,
      spanEnd,
    )
    if (splitAt !== null) {
      const cutIndex = spanEnd
      return {
        cutIndex,
        segments: [
          { start: windowStart, end: splitAt },
          { start: splitAt, end: cutIndex },
        ],
        adjusted: cutIndex !== params.preferredIndex,
        splitTurn: {
          start: boundaryTurn.start,
          end: boundaryTurn.end,
          splitAt,
        },
      }
    }
    // Degenerate turn with no legal intra-turn split (e.g. a lone user
    // message followed by a call/result pair): fall through to keeping the
    // turn live at its start rather than producing an illegal cut.
  }

  const cutIndex = Math.max(
    Math.min(spanStart, messages.length),
    windowStart + 1,
  )
  return {
    cutIndex,
    segments: [{ start: windowStart, end: cutIndex }],
    adjusted: cutIndex !== params.preferredIndex,
  }
}

/**
 * Merge the two summaries produced by a split turn. Empty halves are
 * dropped; otherwise the halves join with the structured-summary separator
 * convention (`\n\n---\n\n`, matching summary-assembly.ts).
 */
export function mergeSplitSummaries(first: string, second: string): string {
  const a = first.trim()
  const b = second.trim()
  if (a.length === 0) return b
  if (b.length === 0) return a
  return `${a}\n\n---\n\n${b}`
}

// Re-exported so callers can resolve the previous kept boundary from the
// same module they plan cuts with.
export const findPreviousKeptBoundary: (messages: Message[]) => number =
  CompactionMessage_.findPreviousKeptBoundary

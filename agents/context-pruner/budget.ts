/**
 * Minimal-surgery budget planner (FID-2026-0824-025).
 *
 * Ports the hermes trajectory-compressor disciplines onto the online pruner:
 * exchanges are segmented on user-message boundaries (a boundary can never
 * split an assistant tool-call from its tool result — results trail their
 * call INSIDE the same exchange), the oldest segments are folded first until
 * the window target is reachable, and head/tail segments are protected so
 * early context and recent work stay verbatim.
 *
 * Embeddable by design: serialized via `.toString()` at factory time; bodies
 * reference only parameters, locals, and factory-baked constants.
 */
import { CHARS_PER_TOKEN } from './constants'

import type { Message } from '../types/util-types'

/** A half-open exchange region [start, end) over the message array. */
export type ExchangeSegment = { start: number; end: number }

/**
 * Segment messages into user-delimited exchanges. The first segment owns any
 * leading non-user prologue so every index belongs to exactly one segment;
 * subsequent segments begin at each user message. Boundaries therefore never
 * land between an assistant tool-call and its trailing tool result.
 */
export function segmentExchanges(
  messages: readonly Message[],
): ExchangeSegment[] {
  const segments: ExchangeSegment[] = []
  const total = messages.length
  let start = 0
  for (let i = 1; i < total; i++) {
    if (messages[i]?.role === 'user') {
      segments.push({ start, end: i })
      start = i
    }
  }
  segments.push({ start, end: total })
  return segments.filter((segment) => segment.end > segment.start)
}

/** Rough token estimate for a message range (chars / CHARS_PER_TOKEN). */
export function tokensForRange(
  messages: readonly Message[],
  start: number,
  end: number,
): number {
  let chars = 0
  // Shape-agnostic estimate: JSON.stringify covers text parts, JSON tool
  // payloads, and image metadata uniformly without narrowing Message content.
  for (let i = start; i < end && i < messages.length; i++) {
    chars += JSON.stringify(messages[i] ?? null).length
  }
  return Math.ceil(chars / CHARS_PER_TOKEN)
}

/**
 * How many OLDEST foldable exchanges to fold so the projected total reaches
 * `targetTokens` (hermes accumulate-until-target). Segments [0,
 * protectedHeadSegments) and the last `protectedTailSegments` segments are
 * protected verbatim. Returns folds = 0 when already under target; folds is
 * clamped to the available foldable span, and `projectedTokens` > target
 * signals the caller to fall back to the full sweep (degradation, not
 * failure).
 */
export function planFoldsToReachTarget(params: {
  exchangeTokenEstimates: readonly number[]
  totalTokens: number
  targetTokens: number
  summaryAllowanceTokens: number
  protectedHeadSegments: number
  protectedTailSegments: number
}): { folds: number; projectedTokens: number } {
  const {
    exchangeTokenEstimates,
    totalTokens,
    targetTokens,
    summaryAllowanceTokens,
    protectedHeadSegments,
    protectedTailSegments,
  } = params
  // Under target ⇒ zero folds and NO new summary allowance is spent.
  if (totalTokens <= targetTokens) {
    return { folds: 0, projectedTokens: totalTokens }
  }
  const foldableStart = Math.max(0, protectedHeadSegments)
  const foldableEnd = Math.max(
    foldableStart,
    exchangeTokenEstimates.length - Math.max(0, protectedTailSegments),
  )

  // Savings model: folding exchange i replaces its tokens with the summary
  // allowance ONCE (the merged summary is written after the last fold), so
  // the projected total after k folds is total − sum(first k) + allowance.
  let accumulated = 0
  let folds = 0
  const needed = totalTokens - targetTokens + summaryAllowanceTokens
  for (let i = foldableStart; i < foldableEnd; i++) {
    if (accumulated >= needed) break
    accumulated += exchangeTokenEstimates[i] ?? 0
    folds += 1
  }

  const projectedTokens = Math.max(
    0,
    totalTokens - accumulated + summaryAllowanceTokens,
  )
  return { folds, projectedTokens }
}

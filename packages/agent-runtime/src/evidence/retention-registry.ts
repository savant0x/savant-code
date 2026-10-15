/**
 * Retention registry — the in-process transport for "was this payload durably
 * stored before something drops it?" (FID-2026-1007-004 step 2).
 *
 * The record's contract is that a transform may discard model-facing bytes only
 * on the strength of a retention handle. The retention itself is decided where
 * it *can* be decided — at the tool-result boundary
 * (`tools/tool-executor/result-lifecycle.ts`), which is already async and which
 * runs BEFORE any compaction layer — while the transforms that discard are
 * synchronous and sit deep inside the message-assembly chain. This registry
 * bridges the two without making that chain async.
 *
 * The record sanctions exactly this as the transport, for exactly this reason:
 * the boundary and the consuming transforms run in one process, and an unproven
 * lookup is not a failure — it is the safe direction, because a transform that
 * cannot prove retention keeps the payload.
 *
 * The store itself is NOT here. This holds verdicts (a handle or a named
 * refusal), never payloads, so it adds no second spill mechanism.
 */
import type { RetentionResult } from './spill'

const outcomes = new Map<string, RetentionResult>()

/** Record the boundary's verdict for one tool call. An empty id is ignored. */
export function rememberRetention(
  toolCallId: string,
  result: RetentionResult,
): void {
  if (!toolCallId) return
  outcomes.set(toolCallId, result)
}

/**
 * The verdict for one tool call, or `undefined` when there is none — which the
 * caller must read as "cannot prove", never as "not retained, so drop freely".
 */
export function lookupRetention(
  toolCallId: string | undefined,
): RetentionResult | undefined {
  if (!toolCallId) return undefined
  return outcomes.get(toolCallId)
}

/** Test-boundary reset (wired into the workspace preload). */
export function resetRetentionRegistry(): void {
  outcomes.clear()
}

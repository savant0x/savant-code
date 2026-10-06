/**
 * Tool outcome state (FID-2026-1006-002 WP3, adopted from T149 idea 3).
 *
 * A tool call's OUTCOME is the model-visible result of the call: the
 * `tool_result` chunk has been emitted and the result sits on the run's result
 * arrays. Recording that moment is what makes an outcome durable — it is
 * deliberately NOT inferred from anything the handler did along the way. A
 * handler that emitted activity, spilled evidence, or produced a provenance
 * receipt has not thereby completed: **auxiliary progress never proves
 * completion** (the design study is `docs/tool-outcome-durability.md`).
 *
 * `outcome_ready` is terminal for a tool call. A call whose outcome is already
 * recorded must never be dispatched again — re-running it would execute a tool
 * the run already has an answer for — so `isRedispatchable('outcome_ready')`
 * is false. A call with no recorded outcome can only report the honest
 * `dispatching`, and that is the one state a dispatch may start from.
 *
 * Both lifecycle branches in `result-lifecycle.ts` record the state, a
 * rejection included: a failed call is a settled outcome, not pending work.
 *
 * The store is in-process and per-run; a tool call id is unique per call, so an
 * id is never reused, and the state dies with the process. `resetToolOutcomes`
 * exists for test isolation. A persistent staging store is NOT in scope of this
 * FID — that is a follow-on if the operator wants it.
 */
export type ToolOutcomeState = 'dispatching' | 'outcome_ready'

const outcomes = new Map<string, ToolOutcomeState>()

/** Record that a tool call's outcome is materialized and no longer pending. */
export function markToolOutcomeReady(toolCallId: string): void {
  outcomes.set(toolCallId, 'outcome_ready')
}

/**
 * The outcome state of a tool call. An unknown id has no recorded outcome, so
 * it reports `dispatching` — the only honest answer — instead of throwing.
 */
export function toolOutcomeState(toolCallId: string): ToolOutcomeState {
  return outcomes.get(toolCallId) ?? 'dispatching'
}

/**
 * Whether a call in this state may be dispatched again. Only an outcome-less
 * call may run; a recorded outcome is terminal.
 */
export function isRedispatchable(state: ToolOutcomeState): boolean {
  return state === 'dispatching'
}

/** Drop every recorded outcome (test seam). */
export function resetToolOutcomes(): void {
  outcomes.clear()
}

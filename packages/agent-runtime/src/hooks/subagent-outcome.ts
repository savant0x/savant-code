/**
 * FID-2026-0919-029 — the subagent lifecycle's outcome entry point.
 *
 * The builder now lives in `./run-outcome` because FID-2026-0919-030 found the
 * SESSION lifecycle with the identical hole (an outcome-blind `SessionEnd`), and
 * one shared core is what keeps the two lifecycles from drifting — the lesson
 * FID-2026-0919-027 paid for when the verdict-receipt binding existed twice and
 * silently diverged. This module stays as the subagent-facing path so
 * FID-2026-0919-029's citations resolve and every subagent call site keeps one
 * import.
 *
 * The three-ending contract, the identity-and-shape-only rule, and the
 * "unknown ⇒ failed" default are documented at the builder.
 */

export {
  buildRunOutcome,
  buildSessionOutcome,
  buildSubagentOutcome,
  errorMessageOf,
} from './run-outcome'
export type {
  RunOutcome,
  RunOutcomeStatus,
  SubagentOutcome,
  SubagentOutcomeStatus,
} from './run-outcome'

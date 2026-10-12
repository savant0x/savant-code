// FID-2026-1006-003: the session record types this FID introduced, extracted
// from session-state-agent-state.ts (quality-gate line ceiling). The parent
// re-exports them, so the public surface is unchanged.

/**
 * WP5: one steering-rule override, as audited by the tool executor's steering
 * gate. A structural twin of the runtime's `SteeringOverrideAudit` (common
 * cannot import the runtime) with a capture time added, so the CLI can persist
 * an orderable durable entry.
 */
export type SteeringOverrideAuditRecord = {
  /** Durable event identity; optional only for legacy snapshots. */
  id?: string
  ruleId: string
  reason: string
  toolName: string
  agentId: string
  /** Capture time (ms) — orders the override against the session history. */
  at: number
}

/**
 * WP1: the compaction cut plan computed at the runtime step boundary. A
 * structural twin of the runtime's `CutPlan` (common cannot import the
 * runtime) because the plan travels to the serialized context pruner as
 * DATA — the embedded pruner cannot import runtime modules.
 */
export type CompactionCutPlan = {
  /** First live (kept) message index; never sits on a tool result. */
  cutIndex: number
  /** Disjoint summary segments covering the summarized window, in order. */
  segments: Array<{ start: number; end: number }>
  /** True when the boundary moved from the requested index. */
  adjusted: boolean
  /**
   * The split boundary turn, or null. Required-and-nullable (not optional) so
   * the whole plan is a plain JSON value on its way to the pruner's spawn
   * params — an optional property would carry `undefined`, which is not JSON.
   */
  splitTurn: { start: number; end: number; splitAt: number } | null
}

/**
 * WP2: the cumulative file-tracking ledger carried across successive
 * compactions. Structural twin of the runtime's `FileTracking`, carried to
 * the pruner as data for the same reason as the cut plan.
 */
export type CompactionFileLedger = {
  readFiles: string[]
  modifiedFiles: string[]
  createdFiles: string[]
}

/**
 * WP3: the loop guard rails' named stop reasons — the decision the step loop
 * used to end the turn.
 */
export type LoopStopReason =
  'stale-cycle' | 'role-budget' | 'iteration-cap' | 'deadline'

import { z } from 'zod'

import { zJson } from '../json/type.ts'

/**
 * THE run-kind vocabulary — defined ONCE, shared by the fn-side outcomes
 * (hooks/lifecycle.ts) and the engine-side results (run/result.ts).
 * UPPERCASE per monid-services convention (v1 zProviderRunStatus:
 * RUNNING/SUCCEEDED/FAILED). Append-only: adding a kind is a host-protocol
 * change (orchestrators must know what to DO with it) and requires an
 * engine minor bump. Endpoint-specific phases are NOT kinds — they ride
 * `state.stage` (the D13 stage-dispatch pattern), which hosts never
 * interpret.
 */
export const RunKind = {
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
} as const
export type RunKind = (typeof RunKind)[keyof typeof RunKind]

/**
 * ENGINE-owned in-flight clock — the v2 carrier of v1 providerRun's
 * startedAt/completedAt posture, feeding the ClickHouse latency waterfall's
 * provider slices (t_provider_start_request_ms, t_provider_polling_ms,
 * t_provider_total_ms). ISO strings: state crosses payload boundaries BY
 * VALUE (v1: "never rely on Date instances surviving payload conversion").
 * Fns READ it (adaptive cadence off attempts/deadlineAt) but cannot write
 * it — they return `zFnState`, which has no timing field, and the
 * engine stamps/advances `timing` itself every tick.
 */
export const zRunTimingInFlight = z.strictObject({
  /** Stamped once, before lifecycle.start (or the declarative request). */
  startedAt: z.iso.datetime(),
  /** Duration of the start tick (fn invocation, transport included). */
  startRequestMs: z.number().int().nonnegative(),
  /** Stamped at the beginning of each poll tick. */
  lastPolledAt: z.iso.datetime().optional(),
  /** Poll tick counter — engine-incremented. */
  attempts: z.number().int().nonnegative(),
  /** Accumulated poll tick durations. */
  pollMsTotal: z.number().int().nonnegative(),
  /** startedAt + timeouts.runMs — recorded IN state so hosts enforce the
   *  SAME budget `run()`'s loop enforces, off the same clock. */
  deadlineAt: z.iso.datetime(),
})
export type RunTimingInFlight = z.infer<typeof zRunTimingInFlight>

/**
 * THE run state (↔ v1 providerRun): the structured envelope threaded
 * between ticks, engine-validated on every boundary. Ownership is split by
 * construction:
 *   - fn-owned: `externalRunId` (the vendor's own run/job id — THE
 *     correlation handle hosts read, ↔ v1 providerRunId), `stage` (the
 *     fn's own dispatch marker, free-form), and `data` (the billing-signal
 *     bag — typed per endpoint when the doc declares `lifecycle.state`,
 *     validated against `doc.lifecycle.stateSchema` each tick).
 *   - engine-owned: `timing` (fns cannot tamper — they return patches).
 * Size discipline: the WHOLE serialized state is capped by config
 * schema.state_max_bytes — ids + billing signals, never payloads.
 */
export const zRunState = z.strictObject({
  externalRunId: z.string().min(1).optional(),
  stage: z.string().optional(),
  data: zJson.optional(),
  timing: zRunTimingInFlight,
})
export type RunState = z.infer<typeof zRunState>

/**
 * What lifecycle fns RETURN — the fn-owned subset, WHOLE-STATE semantics
 * (no field-level merge exists): a PRESENT `state` on an outcome IS the
 * complete next fn-state and replaces the previous one WHOLESALE; an
 * ABSENT `state` carries the previous fn-owned fields forward untouched.
 * Two cases, zero patch rules — the null-vs-undefined merge ambiguity
 * class ("does `data: null` clear or inherit?") is structurally gone
 * (PR #2 finding; the old zStatePatch presence-merge is deleted). States
 * are immutable constants per tick; the engine attaches `timing` itself.
 */
export const zFnState = z.strictObject({
  externalRunId: z.string().min(1).optional(),
  stage: z.string().optional(),
  data: zJson.optional(),
})
export type FnState = z.infer<typeof zFnState>

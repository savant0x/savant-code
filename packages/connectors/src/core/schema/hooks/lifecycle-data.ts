import { z } from 'zod'

import { fnCarrier, type HookLogger } from './ctx.ts'
import { type LifecycleUtils } from './lifecycle.ts'
import { zHttpMethod } from '../common/http.ts'
import { zJson } from '../json/type.ts'
import { zOwnedResource } from '../resource/row.ts'
import { zRunInput } from '../run/input.ts'
import { RunKind, zFnState, zRunState } from '../run/state.ts'

// T106 file split (FID-2026-0930-001, 300-line ceiling): the ctx.data
// shapes, outcomes, and stop-kind vocabulary moved VERBATIM from
// lifecycle.ts. Every export is re-exported from lifecycle.ts unchanged.

// ---------------------------------------------------------------------------
// ctx.data shapes
// ---------------------------------------------------------------------------

/** The doc's compiled request as DATA INTO the lifecycle: {pathParam}s
 *  already substituted, headers merged. By convention `start` executes it
 *  via utils.http; fns may deviate freely. */
export const zLifecycleRequestInfo = z.strictObject({
  method: zHttpMethod,
  url: z.string().min(1),
  headers: z.record(z.string(), z.string()).optional(),
})
export type LifecycleRequestInfo = z.infer<typeof zLifecycleRequestInfo>

/** The run's own identity as ctx data (design D34): `runId` is the
 *  HOST-STABLE run identifier (host-supplied; the engine mints a UUID
 *  when absent) — the deterministic seed for vendor idempotency keys
 *  (saperly's provision saga), stable across activity retries so retried
 *  effects converge upstream. */
export const zLifecycleRunInfo = z.strictObject({
  runId: z.string().min(1),
})
export type LifecycleRunInfo = z.infer<typeof zLifecycleRunInfo>

/** The GATED INSTANCES (design D43): every keyed binding's owned
 *  resource, by alias (`as` ?? the key path's last segment) — fetched
 *  fresh each tick from the host's reader, already ownership-gated.
 *  Absent when the doc declares no keyed bindings. */
export const zGatedResources = z.record(z.string().min(1), zOwnedResource)
export type GatedResources = z.infer<typeof zGatedResources>

/** ctx.data for lifecycle.start — the validated (post-toRequest) input +
 *  the compiled request + the run identity (+ the gated instances when
 *  the doc's bindings carry keys). */
export const zLifecycleStartData = z.strictObject({
  input: zRunInput,
  request: zLifecycleRequestInfo,
  run: zLifecycleRunInfo,
  resources: zGatedResources.optional(),
})
export type LifecycleStartData = z.infer<typeof zLifecycleStartData>

/** ctx.data for lifecycle.poll / lifecycle.stop — plus the threaded state
 *  at its provenance-named path `data.lifecycle.state` (the FULL
 *  structured RunState: the previous tick's fn-owned fields + the
 *  engine-owned timing, which fns may READ — adaptive cadence off
 *  attempts/deadlineAt — but not write; they return zFnState). */
export const zLifecycleTickData = z.strictObject({
  input: zRunInput,
  request: zLifecycleRequestInfo,
  run: zLifecycleRunInfo,
  resources: zGatedResources.optional(),
  lifecycle: z.strictObject({ state: zRunState }),
})
export type LifecycleTickData = z.infer<typeof zLifecycleTickData>

// ---------------------------------------------------------------------------
// outcomes
// ---------------------------------------------------------------------------

/**
 * A run still in flight. `state` is the fn-owned WHOLE next state
 * (zFnState): `externalRunId` (the vendor's run/job id — the correlation
 * handle hosts read: teardown, webhooks), `stage` (dispatch marker) and
 * `data` (billing signals: dataset ids, pricing fields — never payloads).
 * WHOLE-STATE semantics: PRESENT replaces the previous fn-state
 * wholesale; ABSENT carries it forward untouched (no field-level merge —
 * design D21). The engine stamps `timing` itself, validates `data`
 * against the doc's `lifecycle.stateSchema` when declared, and caps the
 * WHOLE state's serialized size (config schema.state_max_bytes →
 * FN_CONTRACT). `pollAfterMs` overrides the doc's `timeouts.pollMs` for
 * the NEXT tick only (adaptive cadence).
 */
export const zLifecycleRunning = z.strictObject({
  kind: z.literal(RunKind.RUNNING),
  state: zFnState.optional(),
  pollAfterMs: z.number().int().positive().optional(),
})

/**
 * The run's RAW envelope: `httpStatus` + `output` feed the ONE settle
 * pipeline exactly like a declarative response would (non-2xx ⇒ provider
 * error, zero usage — engine-forced). `providerHttpStatus` (THEIRS, v1's
 * ours/theirs pair — design D12) is stated ONLY when the fn SYNTHESIZED
 * `httpStatus` (e.g. a failed actor: httpStatus 500, providerHttpStatus
 * 200 — the upstream exchange itself succeeded); absent = relayed
 * verbatim. `state` is the final fn-owned WHOLE state (absent = the
 * previous tick's fn-state carries forward untouched — design D21); the
 * final state rides into the settle envelope so usage.consolidate can
 * read billing signals stashed during polling.
 */
export const zLifecycleCompleted = z.strictObject({
  kind: z.literal(RunKind.COMPLETED),
  httpStatus: z.number().int(),
  providerHttpStatus: z.number().int().optional(),
  output: zJson,
  state: zFnState.optional(),
})

export const zLifecycleOutcome = z.discriminatedUnion('kind', [
  zLifecycleRunning,
  zLifecycleCompleted,
])
export type LifecycleOutcome = z.infer<typeof zLifecycleOutcome>

// ---------------------------------------------------------------------------
// fn types + carriers
// ---------------------------------------------------------------------------

export type LifecycleStartFn = (ctx: {
  data: LifecycleStartData
  utils: LifecycleUtils
  logger: HookLogger
}) => Promise<LifecycleOutcome>
export const zLifecycleStartFn = fnCarrier<LifecycleStartFn>(
  'a lifecycle.start fn',
)

export type LifecyclePollFn = (ctx: {
  data: LifecycleTickData
  utils: LifecycleUtils
  logger: HookLogger
}) => Promise<LifecycleOutcome>
export const zLifecyclePollFn = fnCarrier<LifecyclePollFn>(
  'a lifecycle.poll fn',
)

/**
 * Stop OUTCOMES (design D34) — stop grows a voice: the engine's stop
 * verdict is one of
 *   - COMPLETED          — the fn drained to a terminal vendor state and
 *     returned a full `zLifecycleCompleted` envelope: the run SETTLES
 *     through the one pipeline (metered work that already happened bills
 *     at stop — saperly's hangup).
 *   - UNRESOLVED         — the fn tore down but could NOT observe the
 *     terminal state in its bounded budget: the host must reconcile
 *     out-of-band before money settles.
 *   - STOPPED_UNSETTLED  — the fn returned void (fire-and-forget teardown,
 *     the pre-resource posture) or the doc has no stop fn / no state to
 *     stop; nothing billed, nothing owed.
 * Failures still never mask the stop: a THROW from the fn is swallowed
 * and reported as UNRESOLVED when the doc bills metered work (someone
 * must go look), STOPPED_UNSETTLED otherwise.
 */
export const StopKind = {
  UNRESOLVED: 'UNRESOLVED',
  STOPPED_UNSETTLED: 'STOPPED_UNSETTLED',
} as const
export type StopKind = (typeof StopKind)[keyof typeof StopKind]

export const zStopKind = z.enum(StopKind)

export const zLifecycleUnresolved = z.strictObject({
  kind: z.literal(StopKind.UNRESOLVED),
  /** Operator-facing: what the fn last saw (logged + surfaced). */
  reason: z.string().min(1).optional(),
  state: zFnState.optional(),
})
export type LifecycleUnresolved = z.infer<typeof zLifecycleUnresolved>

export const zLifecycleStopOutcome = z.discriminatedUnion('kind', [
  zLifecycleCompleted,
  zLifecycleUnresolved,
])
export type LifecycleStopOutcome = z.infer<typeof zLifecycleStopOutcome>

/** Teardown with a voice: return an outcome to settle/flag, or void for
 *  the classic best-effort posture. The engine swallows every failure
 *  (cleanup never masks the run outcome — v1 stop posture). */
export type LifecycleStopFn = (ctx: {
  data: LifecycleTickData
  utils: LifecycleUtils
  logger: HookLogger
}) => Promise<LifecycleStopOutcome | void>
export const zLifecycleStopFn = fnCarrier<LifecycleStopFn>(
  'a lifecycle.stop fn',
)

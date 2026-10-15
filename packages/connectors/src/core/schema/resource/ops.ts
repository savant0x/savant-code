import { z } from 'zod'

import { zOwnedResource } from './row.ts'
import { fnCarrier, type FnUtils, type HookLogger } from '../hooks/ctx.ts'
import { type Json, zJson } from '../json/type.ts'

import type { LifecycleHttpFn, LifecycleSleepFn } from '../hooks/lifecycle.ts'

export {
  type OwnedResource,
  type ResourceQuery,
  type ResourceTarget,
  zOwnedResource,
  zResourceQuery,
  zResourceTarget,
} from './row.ts'

/**
 * The RESOURCE LIFECYCLE family (design D30/D41; ↔ v1 resourceDef
 * verify/release/refresh) — the platform-driven, no-user-input phases of
 * a resource def. A resource literally has a lifecycle: is it alive?
 * (`verify`) → re-sync the snapshot (`refresh`) → tear it down
 * (`release`). Effectful fns with the same posture as the endpoint
 * lifecycle family: `utils.http` through the ONE transport port
 * (same-origin credential rule), throw = retriable (RESOURCE_OP_FAILED),
 * `retriable === false` throw = FN_CONTRACT, outcomes zod-validated
 * after the awaited return.
 *
 * ctx.data carries the OWNED INSTANCE as `resource` (design D41 — the
 * host supplies it from its own store; the fn reads
 * `data.resource.externalId` to build URLs). No separate `target`: it
 * was always derivable as {doc.id, resource.externalId}.
 *
 * The HOST workflow owns when/whether (schedules, holds, events,
 * exactly-once); the doc owns how (the upstream HTTP anatomy).
 */

/** `utils` for resource lifecycle/meter/view fns: the pure ABI + `http`
 *  (raw calls against the provider origin) + `sleep` (bounded in-phase
 *  waits). No `external`/view dispatch (design D42): a meter performs
 *  its own reads. */
export interface ResourceOpUtils extends FnUtils {
  http: LifecycleHttpFn
  sleep: LifecycleSleepFn
}

// ---------------------------------------------------------------------------
// ctx.data + outcomes
// ---------------------------------------------------------------------------

/** ctx.data shared by verify / release / refresh — the owned instance. */
export const zResourceOpData = z.strictObject({
  resource: zOwnedResource,
})
export type ResourceOpData = z.infer<typeof zResourceOpData>

/**
 * verify — periodic aliveness (v1's word restored): the host calls it
 * before EVERY charge ("never charge a dead resource") and on demand.
 * ↔ v1 ResourceVerification {active, inactiveReason?, cost?,
 * providerPeriodEnd?}.
 */
export const zVerifyOutcome = z.strictObject({
  active: z.boolean(),
  inactiveReason: z.string().min(1).optional(),
  /** The vendor's own period end, when readable (reconciliation/drift
   *  signal — ↔ v1 providerPeriodEnd). */
  periodEndIso: z.iso.datetime().optional(),
  /** Vendor-observed CURRENT draw for the fixed line(s), when readable
   *  (↔ v1 verify.cost) — the host's drift/max-rule channel; never
   *  changes the sticky charge by itself. Keyed by usage line name. */
  observedUsage: z
    .record(
      z.string().min(1),
      z.strictObject({
        credit: z.string().min(1),
        amount: z.number().nonnegative(),
      }),
    )
    .optional(),
})
export type VerifyOutcome = z.infer<typeof zVerifyOutcome>

/**
 * release — idempotent upstream teardown (v1: 404/410 tolerated as
 * success; stable idempotency keys so retries converge). MAY return the
 * vendor's settled final usage (`settled` — the smolmachine
 * teardown-as-invoice mechanism), keyed by usage line name.
 */
export const zReleaseOutcome = z.strictObject({
  released: z.literal(true),
  settledUsage: z
    .record(
      z.string().min(1),
      z.strictObject({
        credit: z.string().min(1),
        amount: z.number().nonnegative(),
      }),
    )
    .optional(),
})
export type ReleaseOutcome = z.infer<typeof zReleaseOutcome>

/**
 * refresh — re-sync the stored snapshot from upstream (v1 `refresh`):
 * `patch` is the FULL data-field override (the def decides its own
 * carry-forward policy for degraded reads — e.g. saperly's connection
 * pointer is AUTHORITATIVE: absence clears it). The engine validates the
 * patch against the doc's data schema.
 */
export const zRefreshOutcome = z.strictObject({
  active: z.boolean(),
  patch: zJson.optional(),
})
export type RefreshOutcome = z.infer<typeof zRefreshOutcome>

export type ResourceVerifyFn = (ctx: {
  data: ResourceOpData
  utils: ResourceOpUtils
  logger: HookLogger
}) => Promise<VerifyOutcome>
export const zResourceVerifyFn = fnCarrier<ResourceVerifyFn>(
  'a lifecycle.verify fn',
)

export type ResourceReleaseFn = (ctx: {
  data: ResourceOpData
  utils: ResourceOpUtils
  logger: HookLogger
}) => Promise<ReleaseOutcome>
export const zResourceReleaseFn = fnCarrier<ResourceReleaseFn>(
  'a lifecycle.release fn',
)

export type ResourceRefreshFn = (ctx: {
  data: ResourceOpData
  utils: ResourceOpUtils
  logger: HookLogger
}) => Promise<RefreshOutcome>
export const zResourceRefreshFn = fnCarrier<ResourceRefreshFn>(
  'a lifecycle.refresh fn',
)

// ---------------------------------------------------------------------------
// views — named LIVE reads of the upstream object (design D42;
// ↔ v1 externalKinds inspect)
// ---------------------------------------------------------------------------

/** ctx.data for a view read: the owned instance + optional caller
 *  args. */
export const zViewData = z.strictObject({
  resource: zOwnedResource,
  args: zJson.optional(),
})
export type ViewData = z.infer<typeof zViewData>

export type ViewReadFn = (ctx: {
  data: ViewData
  utils: ResourceOpUtils
  logger: HookLogger
}) => Promise<Json>
export const zViewReadFn = fnCarrier<ViewReadFn>('a views read fn')

/** One named LIVE view of the upstream object — always fetched fresh,
 *  never persisted. `label` is the human name; what shows WHERE is the
 *  host's call (no display flag — design D42). */
export const zView = z.strictObject({
  label: z.string().min(1).optional(),
  read: zViewReadFn,
})
export type View = z.infer<typeof zView>

export const zViews = z.record(
  z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'view kind must be lowercase kebab-case'),
  zView,
)
export type Views = z.infer<typeof zViews>

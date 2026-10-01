import { z } from 'zod'

import { fnCarrier, type HookLogger, zFnUtils, zHookLogger } from './ctx.ts'
import { zJson } from '../json/type.ts'
import { zResourceId } from '../resource/ids.ts'
import { zLineConsumes } from '../resource/usage.ts'
import { zRunInput } from '../run/input.ts'
import { zFnState } from '../run/state.ts'

import type { LifecycleUtils } from './lifecycle.ts'

/**
 * ENDPOINT↔RESOURCE BINDING HOOKS (design D32) — the two fns a binding may
 * carry. The binding itself (`resource:` on the endpoint def) is pure
 * data; `seed` and `ensure` are its code seams:
 *
 *   - `seed` (CREATES-only, PURE, post-success): the settled envelope →
 *     the provision record(s) the host persists. Runs ONLY on a 2xx
 *     settle; a null return means "this success provisioned nothing"
 *     (lawful — e.g. a dry-run flag).
 *   - `ensure` (EFFECTFUL, pre-run): makes prerequisites TRUE — verify /
 *     provision dependencies before the run starts (v1
 *     `ensureResources`). Returned seeds are persisted by the host
 *     BEFORE the run executes, so a mid-run crash never orphans an
 *     upstream resource.
 */

/**
 * One provision record — what the host persists as an owned-resource row
 * + its billing schedule:
 *   - `resource`: the resource DOC id — self-describing (ensure may seed
 *     resources of OTHER docs).
 *   - `externalId`: the vendor's identifier (the ownership-pointer key).
 *   - `identifier`: the human display handle (the E.164, the mailbox
 *     address) — defaults to externalId host-side.
 *   - `data`: the initial `data`-schema snapshot (engine-validated
 *     against the resource doc's dataSchema when resolvable).
 *   - `observedUsage`: the OBSERVED period-1 draw per FIXED usage line
 *     (v1 sticky max-rule seed) — what the vendor actually quoted at
 *     purchase; absent means "the doc's card is the whole truth".
 */
export const zProvisionSeed = z.strictObject({
  resource: zResourceId,
  externalId: z.string().min(1),
  identifier: z.string().min(1).optional(),
  data: zJson,
  observedUsage: z.record(z.string().min(1), zLineConsumes).optional(),
})
export type ProvisionSeed = z.infer<typeof zProvisionSeed>

/** ctx.data for `seed` — the SETTLED SUCCESS envelope: validated input,
 *  final output, final fn-state (billing/provision signals stashed during
 *  the lifecycle ride here). */
export const zProvisionSeedData = z.strictObject({
  input: zRunInput,
  output: zJson,
  state: zFnState.optional(),
})
export type ProvisionSeedData = z.infer<typeof zProvisionSeedData>

export const zProvisionSeedCtx = z.object({
  data: zProvisionSeedData,
  utils: zFnUtils,
  logger: zHookLogger,
})

export const ProvisionSeedContract = z.function({
  input: [zProvisionSeedCtx],
  output: zProvisionSeed.nullable(),
})
export type ProvisionSeedFn = z.infer<typeof ProvisionSeedContract>
export const zProvisionSeedFn = fnCarrier<ProvisionSeedFn>('a resource seed fn')

/**
 * ctx.data for `ensure` — the validated input + the host's OPAQUE scope
 * token (`scope.key`): a stable string naming the calling workspace
 * (never its contents — fns can use it in vendor idempotency keys, e.g.
 * "one mailbox per workspace", without learning anything). The OSS run
 * path passes a fixed local token.
 */
export const zEnsureData = z.strictObject({
  input: zRunInput,
  scope: z.strictObject({ key: z.string().min(1) }),
})
export type EnsureData = z.infer<typeof zEnsureData>

/** ensure gets the FULL lifecycle utils (http/request/sleep/resources):
 *  it exists to reach upstream, and `resources` answers "do we already
 *  own one". */
export type EnsureFn = (ctx: {
  data: EnsureData
  utils: LifecycleUtils
  logger: HookLogger
}) => Promise<ProvisionSeed[]>
export const zEnsureFn = fnCarrier<EnsureFn>('a resource ensure fn')

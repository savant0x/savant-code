import { z } from 'zod'

import { fnCarrier, zFnUtils, zHookLogger } from './ctx.ts'
import { zRunInput } from '../run/input.ts'
import { zUsageModel } from '../usage/model/mod.ts'
import { zFnUsage } from '../usage/usage.ts'

/**
 * HOOK usage.estimate — the PRE-RUN cost estimate (v1
 * `paymentLifecycle.estimate`): validated caller input → an estimated
 * `Usage` with the SAME `counts` keys `usage.consolidate` settles in (the
 * admission hold is priced from it by the host; settle trues it up
 * key-by-key). PURE + sync like the other non-lifecycle hooks — no IO, no
 * state, INPUT-only: the estimate is the settle's promise, made before
 * the vendor is touched (engine-executed via `estimate(runInput)`).
 *
 * Absent ⇒ the engine defaults to `{counts: {}}` — a flat doc needs no
 * estimate, the model + success is its whole story (design D18/D19).
 * Estimates are TYPED INLINE fns on their docs (design D23 — no estimate
 * presets): the body is `z.output` of the doc's own input schema and the
 * counts keys are the model's literal metered keys, so field typos and
 * foreign keys fail `deno task check`.
 *
 * `usage.model` mirrors the envelope ctx: the doc's own usage.model,
 * GROUPED under the section it comes from (`data.usage.model` — the ctx
 * path says the provenance), so a generic provider-seam fn can derive its
 * counts KEY (leaf → unit, composite → the sole metered component id)
 * without per-doc arguments.
 */
export const zEstimateData = z.strictObject({
  input: zRunInput,
  /**
   * Milliseconds since the run's admitted start (design D40 — the v1
   * `paymentLifecycle.estimate({elapsedMs})` shape): ABSENT at
   * admission (the fn's own floor prices the initial hold), SET when
   * the host RE-RUNS the estimate on the doc's
   * `usage.updateEstimateEveryMs` cadence while the run is RUNNING —
   * "the price is an estimation, and it syncs once in a while". Docs
   * without that cadence never see it.
   */
  elapsedMs: z.number().nonnegative().optional(),
  /** The doc's own usage section facts — `data.usage.model`. */
  usage: z.strictObject({ model: zUsageModel }),
})
export type EstimateData = z.infer<typeof zEstimateData>

export const zEstimateCtx = z.object({
  data: zEstimateData,
  utils: zFnUtils,
  logger: zHookLogger,
})

export const UsageEstimateContract = z.function({
  input: [zEstimateCtx],
  output: zFnUsage,
})
export type UsageEstimateFn = z.infer<typeof UsageEstimateContract>
export const zUsageEstimateFn = fnCarrier<UsageEstimateFn>(
  'a usage.estimate fn',
)

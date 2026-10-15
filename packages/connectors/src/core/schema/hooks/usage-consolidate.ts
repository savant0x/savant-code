import { z } from 'zod'

import { fnCarrier } from './ctx.ts'
import { zEnvelopeCtx } from './from-response.ts'
import { zJson } from '../json/type.ts'

/**
 * HOOK usage.consolidate — the VENDOR-METER settle fn (design D27,
 * restored to the word's original job): pull the vendor's own
 * consumed-credits number OUT of the payload —
 *
 *     { credits: Record<poolId, number>, output?: Json }
 *
 * One motion, two results (`utils.json.pluck` returns both): `credits`
 * is what the VENDOR says this run consumed, per declared credit pool;
 * `output` is the payload with that billing field removed (absent =
 * unchanged — e.g. the meter lives in threaded lifecycle state, not the
 * user-facing output).
 *
 * OPTIONAL (endpoint ?? provider): not every vendor reports a meter
 * (octen doesn't). Typically PROVIDER-level — where the vendor puts its
 * meter is a provider-wide fact, so the strip is written once while
 * endpoints override only their quantities logic (`usage.evidence`).
 *
 * Semantics at settle (engine-owned, design D27):
 *   - OMIT a pool entry when the vendor didn't report (don't `?? 0`);
 *     zero entries are pruned — an all-empty claim falls back to the
 *     derived fold (our rate card), no mismatch.
 *   - A non-empty claim WINS (`usage.credits` = the vendor's number —
 *     source of truth); the derived fold becomes the cross-check, and a
 *     disagreement rides out as `usage.mismatch.derived` (never fails
 *     the run).
 *   - Claim pool ids must be DECLARED credit systems (FN_CONTRACT
 *     otherwise — a nonzero claim on a FREE doc trips this loudly).
 * Runs on the RAW envelope BEFORE fromResponse, beside usage.evidence.
 * Vendor error ⇒ zero usage forced (the hook never runs).
 */
export const zConsolidated = z.strictObject({
  /** The vendor's OWN consumption claim, per declared credit pool. */
  credits: z.record(z.string().min(1), z.number().nonnegative()),
  /** The payload with the billing field removed; absent = unchanged. */
  output: zJson.optional(),
})
export type Consolidated = z.infer<typeof zConsolidated>

export const UsageConsolidateContract = z.function({
  input: [zEnvelopeCtx],
  output: zConsolidated,
})
export type UsageConsolidateFn = z.infer<typeof UsageConsolidateContract>
export const zUsageConsolidateFn = fnCarrier<UsageConsolidateFn>(
  'a usage.consolidate fn',
)

import { z } from 'zod'

import { COMPOSITE_MODEL_KIND, zCompositeModel } from './composite.ts'
import { FREE_MODEL_KIND, zFreeModel } from './free.ts'
import { PER_CALL_MODEL_KIND, zPerCallModel } from './per-call.ts'
import { PER_UNIT_MODEL_KIND, zPerUnitModel } from './per-unit.ts'
import { extractZodDiscriminatorKeys } from '../../zod-util.ts'

/**
 * usage.model — the RATE-FREE billing-shape ALGEBRA: WHAT an endpoint's
 * consumption looks like, never what it costs (rates live in the hosted
 * rate card, keyed by endpoint + OUR account tier — verified necessary:
 * apify event prices are tiered by subscription plan). Two operators
 * (designs D18 + D19):
 *
 *   - LEAF:      FREE (never bills — design D25), PER_CALL (flat — the
 *                run is the product, billed 1 iff success) and PER_UNIT
 *                (metered — billed per N of `unit`).
 *   - AND:       COMPOSITE — the sum of scalar components, KEYED BY
 *                COMPONENT ID (flat start fee AND per-item metering).
 *                FREE is never a component (a free component is an
 *                omitted component).
 *
 * Grammar, closed and total: "a simple charge, or a keyed sum of simple
 * charges". Deliberately absent — every v1 price type maps in WITHOUT a
 * new kind, because FNS OWN ALL CONDITIONS (design D19):
 *   - TIERED ("default + gated add-on lines, SUMMED"): a gated line is a
 *     composite component whose count is 0 when the feature is off — the
 *     `when` gate becomes counting logic, not a model shape.
 *   - PER_UNIT_MATRIX / VARIANT ("input options pick ONE cell"): a
 *     select-one is a composite whose fn populates ONLY the selected key
 *     (linkedin's profileScraperMode). The VARIANT kind is deleted.
 *   - volume schedules ("first 1k tokens at X"): a shape of the services
 *     CARD ROW; base-covers-first-N (exa) is a composite with an OFFSET
 *     counting rule (counts["additional_result"] = max(0, n − 10)).
 */
export const zUsageModel = z.discriminatedUnion('kind', [
  zFreeModel,
  zPerCallModel,
  zPerUnitModel,
  zCompositeModel,
])
export type UsageModel = z.infer<typeof zUsageModel>
/** The AUTHORING shape (z.input): `every` optional before the parse
 *  materializes its default — defineEndpoint's generic constrains on
 *  this (design D26). */
export type UsageModelSeed = z.input<typeof zUsageModel>

// The RUNTIME kind enum is DERIVED from the union (v1 zPriceTypes
// pattern) — validation can never go stale against the union.
const kinds = extractZodDiscriminatorKeys(zUsageModel, 'kind')
export const zUsageModelKind = z.enum(
  kinds as [UsageModelKind, ...UsageModelKind[]],
  { message: 'Invalid usage model kind' },
)

/** The authoring const — LITERAL-typed (each member keeps its exact kind,
 *  so `UsageModelKind.PER_UNIT` discriminates the union at compile time;
 *  an Object.fromEntries derivation would widen every member). Built from
 *  the same per-file KIND constants the union is; the load-time assert
 *  below keeps it provably in sync with the DERIVED enum. */
export const UsageModelKind = {
  FREE: FREE_MODEL_KIND,
  PER_CALL: PER_CALL_MODEL_KIND,
  PER_UNIT: PER_UNIT_MODEL_KIND,
  COMPOSITE: COMPOSITE_MODEL_KIND,
} as const
export type UsageModelKind =
  (typeof UsageModelKind)[keyof typeof UsageModelKind]

// Staleness guard (module load, hit by every test run): a kind added to
// the union without a const member — or vice versa — fails immediately.
const constKinds = Object.values(UsageModelKind)
if (
  kinds.length !== constKinds.length ||
  !kinds.every((kind) => (constKinds as string[]).includes(kind))
) {
  throw new Error('UsageModelKind const is stale against the zUsageModel union')
}

export * from './consumes.ts'
export * from './free.ts'
export * from './per-call.ts'
export * from './per-unit.ts'
export * from './scalar.ts'
export * from './composite.ts'

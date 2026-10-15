import { z } from 'zod'

import { zScalarUsageModel } from './scalar.ts'

export const COMPOSITE_MODEL_KIND = 'COMPOSITE' as const

/**
 * Component id — THE key everything joins on: `usage.counts[id]`, the
 * broker card row (endpoint, tier, id), the pricing drift guard's event
 * match, and the run record's stashed live rates. For apify the id is the
 * vendor's charge-event name VERBATIM (actor-start, comment, search-page…)
 * — one string ties doc, counts, card and vendor truth together, so
 * per-event prices match exactly (design D19).
 */
export const zComponentId = z.string().min(1)

/**
 * AND — the SUM of scalar components, KEYED BY ID: all may bill on the
 * same run (e.g. the verified apify actor-start fee AND per-item metering:
 * `{ "actor-start": PER_CALL, "comment": PER_UNIT·RESULT }`). The hosted
 * rate card prices one row per component and sums. The map REPLACES the
 * old anonymous array — id uniqueness is structural, and the old
 * constraints (≤1 PER_CALL, distinct PER_UNIT units) are gone with it:
 * they existed only because (kind, unit) was the implicit key, and they
 * forbade the models vendors actually publish (tiktok-comments' two flat
 * events; linkedin's two same-unit profile rates). Components are SCALARS
 * only — no nesting: conditional lines, offsets and input-selected rates
 * are COUNTING rules owned by consolidate/estimate, never model shapes
 * (design D19 — v1's TIERED gates and PER_UNIT_MATRIX both dissolve here).
 */
export const zCompositeModel = z.strictObject({
  kind: z.literal(COMPOSITE_MODEL_KIND),
  components: z
    .record(zComponentId, zScalarUsageModel)
    .refine((components) => Object.keys(components).length >= 2, {
      message: 'a composite prices at least two components',
    }),
})
export type CompositeModel = z.infer<typeof zCompositeModel>

import { z } from 'zod'

import { zUnit } from '../unit.ts'
import { zConsumes } from './consumes.ts'

export const PER_UNIT_MODEL_KIND = 'PER_UNIT' as const

/**
 * Metered pricing — billed per N of `unit` (RESULT, PAGE, TOKEN, time…):
 * the counted quantity is the product. Fns report the QUANTITY as a
 * `counts` entry; the ENGINE folds it into credits through `consumes`
 * (design D26): fold = ceil(quantity / every) × amount, billed in whole
 * increments. PURE scalar: no base-fee side pocket — combining with a
 * flat line is COMPOSITE's job (design D18). CALL is not in zUnit, so
 * "metered in calls" cannot be written; PER_CALL is its own kind.
 */
export const zPerUnitModel = z.strictObject({
  kind: z.literal(PER_UNIT_MODEL_KIND),
  unit: zUnit,
  /** "every N units consume `consumes.amount`" (design D26 — akta
   *  employee-reviews: every 50 reviews consume 1.5 credits). Optional
   *  at authoring, DEFAULT 1 — materialized explicitly at parse, so
   *  every compiled doc carries a concrete integer. */
  every: z.number().int().min(1).default(1),
  /** The line's draw against a declared credit system — the def IS the
   *  rate card (design D26). */
  consumes: zConsumes,
  /** OPTIONAL short display name for billing surfaces (e.g. "reviews",
   *  "extra results"). Rendering is services-side with the KEY as
   *  fallback: `${label ?? key} × ${count}` (design D24). */
  label: z.string().min(1).max(40).optional(),
  /** Human note on WHAT the count means when the fn derives it (e.g.
   *  exa: "results above the 10 included in the base fee"; linkedin:
   *  "profiles scraped in 'Full' mode"). Documentation only — never a
   *  join key (design D19). */
  description: z.string().min(1).optional(),
})
export type PerUnitModel = z.infer<typeof zPerUnitModel>

import { z } from 'zod'

import { zConsumes } from './consumes.ts'

export const PER_CALL_MODEL_KIND = 'PER_CALL' as const

/**
 * Flat per-run pricing — the RUN is the product. Drawn 1 iff success,
 * 0 on provider error; the quantity is structurally constant, so fns
 * never write it — the ENGINE appends the flat `1` to the evidence and
 * folds `consumes.amount` once per run (design D24/D26). No `every`:
 * there is no unit count to bundle. Also the flat line COMPOSITE embeds
 * (the apify actor-start charge event).
 */
export const zPerCallModel = z.strictObject({
  kind: z.literal(PER_CALL_MODEL_KIND),
  /** The line's flat draw against a declared credit system — the def IS
   *  the rate card (design D26). */
  consumes: zConsumes,
  /** OPTIONAL short display name for billing surfaces (e.g. "base fee").
   *  Rendering is services-side with the KEY as fallback (design D24). */
  label: z.string().min(1).max(40).optional(),
  /** Human note on WHAT the flat charge covers when it isn't obvious
   *  (e.g. exa: "base fee — includes the first 10 results").
   *  Documentation only — never a join key (design D19). */
  description: z.string().min(1).optional(),
})
export type PerCallModel = z.infer<typeof zPerCallModel>

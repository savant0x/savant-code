import { z } from 'zod'

/**
 * What FNS return (design D26): typed QUANTITIES only — one entry per
 * metered rate-card line (a composite's PER_UNIT line ids / a leaf
 * PER_UNIT's unit). No rate math, no receipts: flat lines are
 * engine-appended, the credits fold is engine-owned, and vendor billing
 * fields live in the RAW run record (hosts persist the raw envelope —
 * the receipt IS the output).
 */
export const zFnUsage = z
  .object({
    counts: z.record(z.string().min(1), z.number().nonnegative()),
  })
  .strict()
export type FnUsage = z.infer<typeof zFnUsage>

/**
 * The PUBLIC usage (designs D26/D27) — the same two facts, both
 * re-derivable and broker-generic:
 *   1. `credits`  — how many credits consumed, per declared credit
 *      system: the priced vector (broker: credits[id] × card row).
 *      When the vendor reports its OWN meter (`usage.consolidate`),
 *      that claim IS this number — source of truth; otherwise it is
 *      the engine's fold of evidence through the doc's rate card.
 *   2. `evidence` — WHY: one entry per rate-card line (units consumed
 *      for PER_UNIT lines, 1 for PER_CALL lines — engine-appended).
 *      Anyone holding the DOC re-derives the fold from evidence × the
 *      model's every/amount: the bill is checkable from public facts.
 * Plus ONE signal, present only when the two calculations disagree
 * (design D27): `mismatch.derived` carries OUR fold when the vendor's
 * claim (already in `credits`) differs — "vendor says X, we compute Y"
 * — surfaced, never hidden, never failing the run. Same interface
 * otherwise; only how `credits` was calculated differs.
 */
export const zUsage = z
  .object({
    credits: z.record(z.string().min(1), z.number().nonnegative()),
    evidence: z.record(z.string().min(1), z.number().nonnegative()),
    mismatch: z
      .strictObject({
        /** The engine's rate-card fold — the number WE compute from
         *  evidence; `credits` holds the vendor's disagreeing claim. */
        derived: z.record(z.string().min(1), z.number().nonnegative()),
      })
      .optional(),
  })
  .strict()
export type Usage = z.infer<typeof zUsage>

/** A hookless/absent-estimate fn consumed nothing countable. */
export function defaultFnUsage(): FnUsage {
  return { counts: {} }
}

/** Forced on vendor errors — the run billed nothing (and a FREE run's
 *  success settles the same shape: the MODEL is the free fact). */
export function zeroUsage(): Usage {
  return { credits: {}, evidence: {} }
}

import { z } from 'zod'

/** Fully-resolved timeouts (compiled docs). `pollMs` (the poll-loop cadence
 *  default; a running tick may override per tick) is emitted iff the doc's
 *  lifecycle.poll resolves — a sync doc never carries it. */
export const zTimeouts = z.strictObject({
  requestMs: z.number().int().positive(),
  runMs: z.number().int().positive(),
  pollMs: z.number().int().positive().optional(),
})
export type Timeouts = z.infer<typeof zTimeouts>

/** The shared SECTION shape (author-side partial) — falls back endpoint ??
 *  provider ?? config defaults. (Not "Seed": that term is reserved for the
 *  z.input def types.) An ENDPOINT-level `pollMs` without a resolved
 *  lifecycle.poll is dead config (compile error). */
export const zTimeoutsSection = z.strictObject({
  requestMs: z.number().int().positive().optional(),
  runMs: z.number().int().positive().optional(),
  pollMs: z.number().int().positive().optional(),
})
export type TimeoutsSection = z.infer<typeof zTimeoutsSection>

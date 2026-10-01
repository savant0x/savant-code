import { z } from 'zod'

import { fnCarrier } from './ctx.ts'
import { zEnvelopeCtx } from './from-response.ts'
import { zFnUsage } from '../usage/usage.ts'

/**
 * HOOK usage.evidence — the QUANTITIES settle fn (design D27; the
 * pre-D27 "consolidate" renamed to the thing it produces): RAW envelope →
 * `{counts}` — one entry per metered rate-card line, mirroring
 * `usage.estimate` which promises the SAME shape pre-run (estimate
 * promises evidence, evidence settles it; both feed the public
 * `usage.evidence` field after the engine appends the model's flat 1s).
 *
 * ONE job only: derive quantities from the response. No rate math, no
 * receipt plumbing, no output reshaping — the vendor's own meter (and
 * its removal from the payload) is `usage.consolidate`'s job.
 *
 * Must RESOLVE for every doc whose model has METERED lines (endpoint ??
 * provider — compile error if neither); for FREE/flat models the
 * compiler synthesizes the one lawful fn `() => ({counts: {}})`. Runs on
 * the RAW envelope BEFORE fromResponse — billing truth anchors to the
 * wire, so a presentation change can never silently change a bill.
 * Vendor error ⇒ zero usage forced (the hook never runs).
 */
export const UsageEvidenceContract = z.function({
  input: [zEnvelopeCtx],
  output: zFnUsage,
})
export type UsageEvidenceFn = z.infer<typeof UsageEvidenceContract>
export const zUsageEvidenceFn = fnCarrier<UsageEvidenceFn>(
  'a usage.evidence fn',
)

import { z } from 'zod'

import {
  fnCarrier,
  zFnUtils,
  zHookLogger,
  zOutputByConstruction,
} from './ctx.ts'
import { zJson } from '../json/type.ts'
import { zRunInput } from '../run/input.ts'
import { zUsageModel } from '../usage/model/mod.ts'

/**
 * HOOKS output.fromResponse + output.fromError — the two presentation
 * projections, sharing ONE contract shape (envelope in, Json out; returns
 * FN_CONTRACT-validated — the "transform must guarantee JSON" rule):
 *
 *   - `fromResponse`: consolidated SUCCESS response → the user-facing
 *     output (CSV → rows, reshaping).
 *   - `fromError`: vendor PROVIDER-ERROR envelope → a digestible error
 *     shape (design D12 — v1's per-call-site `apifyErrorBody` normalization
 *     as ONE hook). Runs ONLY on provider-error results, AFTER zero-usage
 *     forcing (structurally cannot touch a bill); absent ⇒ the raw body
 *     passes through. Convention: keep the raw body under a `raw` key —
 *     digest, never hide. `output.schema` applies to fromResponse output
 *     only (success shape), never to error projections.
 *
 * The envelope data shape is shared with usage.consolidate.
 */

/** ctx.data for post-response hooks — the validated input + decoded
 *  output, plus two PROVENANCE-NAMED groups (the ctx path says where a
 *  fact comes from):
 *   - `lifecycle.state` — present only for lifecycle (async) runs that
 *     produced state: the final threaded state, so settle fns can read
 *     billing signals stashed during polling (e.g. Apify's pricing fields
 *     ride the poll response, not the dataset).
 *   - `usage.model` — the DOC'S OWN usage.model (REQUIRED on every doc):
 *     a GENERIC provider consolidate keys its `usage.counts` by looking
 *     the component id up here — leaf → the unit, composite → the sole
 *     PER_UNIT component (single-valued by the loader's ≥2-metered rule)
 *     — with zero per-doc code (design D19). */
export const zEnvelopeData = z.strictObject({
  input: zRunInput,
  output: zOutputByConstruction,
  /** Async-run facts — absent for declarative runs and for lifecycle
   *  runs that never set state. */
  lifecycle: z.strictObject({ state: zJson }).optional(),
  /** The doc's own usage section facts. */
  usage: z.strictObject({ model: zUsageModel }),
})
export type EnvelopeData = z.infer<typeof zEnvelopeData>

export const zEnvelopeCtx = z.object({
  data: zEnvelopeData,
  utils: zFnUtils,
  logger: zHookLogger,
})

export const OutputFromResponseContract = z.function({
  input: [zEnvelopeCtx],
  output: zJson,
})
export type OutputFromResponseFn = z.infer<typeof OutputFromResponseContract>
export const zOutputFromResponseFn = fnCarrier<OutputFromResponseFn>(
  'an output.fromResponse fn',
)

/** Same contract shape, its own carrier (a def field must name its hook). */
export const OutputFromErrorContract = OutputFromResponseContract
export type OutputFromErrorFn = OutputFromResponseFn
export const zOutputFromErrorFn = fnCarrier<OutputFromErrorFn>(
  'an output.fromError fn',
)

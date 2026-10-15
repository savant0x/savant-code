import { z } from 'zod'

import {
  zOutputFromErrorFn,
  zOutputFromResponseFn,
  zSchemaCarrier,
} from '../hooks/mod.ts'

/**
 * Output section — SHARED by EndpointDef and ProviderDef (leaf-wise fallback):
 *   - `fromResponse`: raw decoded SUCCESS response → the user-facing output
 *     (CSV → rows, reshaping, honest field removal — visible in the doc,
 *     same for ALL callers; there is no host-gated redaction in this
 *     standard). Endpoint hook REPLACES the provider's.
 *   - `fromError`: PROVIDER-ERROR envelope → a digestible error shape
 *     (design D12): runs only on provider-error results, after zero-usage
 *     forcing; absent ⇒ raw passthrough. Keep the raw body under a `raw`
 *     key — digest, never hide.
 *   - `schema`: validates the FINAL user-facing SUCCESS output, i.e. AFTER
 *     fromResponse. The raw vendor payload and error projections are never
 *     schema-checked.
 *
 * There is no decode flag: the engine sniffs — JSON if the body parses, else
 * the faithful raw string (a string is valid Json).
 */
export const zOutputSection = z.strictObject({
  fromResponse: zOutputFromResponseFn.optional(),
  fromError: zOutputFromErrorFn.optional(),
  schema: zSchemaCarrier.optional(),
})
export type OutputSection = z.infer<typeof zOutputSection>

import { z } from 'zod'

import { zInputToRequestFn, zSchemaCarrier } from '../hooks/mod.ts'

/**
 * Input section — SHARED by EndpointDef and ProviderDef (one shape, both
 * scopes; leaf-wise fallback resolves endpoint ?? provider):
 *   - `schema.{body,queryParams,pathParams}`: what callers submit, validated
 *     FIRST (live zod in the def; JSON Schema in the doc).
 *   - `toRequest`: validated caller input → the input actually sent (e.g. exa
 *     strips its unsupported `stream` flag). Runs AFTER validation, BEFORE
 *     the wire call. Endpoint hook REPLACES the provider's (fallback, not
 *     chain).
 */
export const zInputSection = z.strictObject({
  schema: z
    .strictObject({
      body: zSchemaCarrier.optional(),
      queryParams: zSchemaCarrier.optional(),
      pathParams: zSchemaCarrier.optional(),
    })
    .optional(),
  toRequest: zInputToRequestFn.optional(),
})
export type InputSection = z.infer<typeof zInputSection>

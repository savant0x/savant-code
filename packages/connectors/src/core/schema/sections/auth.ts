import { z } from 'zod'

import { zAuthInjectFn, zSchemaCarrier } from '../hooks/mod.ts'

/**
 * Auth section — SHARED by EndpointDef and ProviderDef (leaf-wise fallback);
 * the two halves of credential handling, grouped:
 *   - `inject`: the FUNCTION that puts the secret into the outgoing request
 *     (usually presets.auth.header("x-api-key")). Executed only by the
 *     injector (directTransport locally, hosted Relay), never the pipeline.
 *     Must RESOLVE endpoint ?? provider (compile error if neither).
 *   - `credentials`: the zod SHAPE of the secret material. Falls back
 *     endpoint ?? provider ?? DEFAULT ({ apiKey: non-empty string }) — which
 *     is why most providers (exa included) never declare it; only
 *     non-standard shapes (user+password, multiple keys) do. Compiled to
 *     JSON Schema in the doc; the injector validates RESOLVED secrets
 *     against it (→ MISSING_CREDENTIAL) before running inject.
 *
 * No secret VALUE ever appears in a def, doc, bundle, or this repo — only
 * the shape travels; values come from env (local) or Broker/KMS (hosted).
 */
export const zAuthSection = z.strictObject({
  inject: zAuthInjectFn.optional(),
  /** `.optional()`, deliberately NOT `.default(zDefaultCredentials)`:
   *  `.default()` fires at def-parse time PER LEVEL, so an endpoint that
   *  overrides only `inject` would get the default materialized and
   *  SHADOW its provider's explicit credentials — destroying the
   *  `undefined` signal the endpoint ?? provider ?? default chain needs.
   *  The rule generalizes: shared section fields are `.optional()`, never
   *  `.default()`; terminal defaults are applied by the COMPILER after
   *  fallback resolution (design D20; pinned by a compiler test). */
  credentials: zSchemaCarrier.optional(),
})
export type AuthSection = z.infer<typeof zAuthSection>

/** Default credentials shape when neither endpoint nor provider declares one. */
export const zDefaultCredentials = z.object({ apiKey: z.string().min(1) })

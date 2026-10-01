import { z } from 'zod'

import { zHttpMethod } from '../common/http.ts'

/**
 * Request section, two scopes of ONE shape family (leaf-wise fallback):
 *   - Provider side (`zRequestDefaults`): `{baseUrl?, headers?}` — the
 *     defaultable leaves. Strictness prevents method/path at provider level.
 *   - Endpoint side (`zEndpointRequest`): adds the endpoint-identifying
 *     `method` + `path` (required) and may override `baseUrl`.
 * Compiler resolution: url = (endpoint.baseUrl ?? provider.request.baseUrl)
 * + path — neither present → compile error naming the endpoint. Headers
 * merge key-wise (endpoint key wins — each header key is a leaf).
 */
export const zRequestDefaults = z.strictObject({
  baseUrl: z.url().optional(),
  /** Static extra headers. */
  headers: z.record(z.string(), z.string()).optional(),
})
export type RequestDefaults = z.infer<typeof zRequestDefaults>

export const zEndpointRequest = z.strictObject({
  ...zRequestDefaults.shape,
  method: zHttpMethod,
  /** Wire path, e.g. "/search"; may contain {pathParam} placeholders. */
  path: z.string().regex(/^\//, 'path must start with /'),
})
export type EndpointRequest = z.infer<typeof zEndpointRequest>

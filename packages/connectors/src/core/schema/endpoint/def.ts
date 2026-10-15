import { z } from 'zod'

import { zEndpointPath } from '../common/ids.ts'
import { zEndpointMeta } from '../meta/endpoint.ts'
import {
  zAuthSection,
  zEndpointRequest,
  zInputSection,
  zLifecycleSection,
  zOutputSection,
  zResourcesSection,
  zTimeoutsSection,
  zUsageSection,
} from '../sections/mod.ts'

/**
 * zEndpointDef — the AUTHOR-side schema, zod-first:
 *   EndpointDefSeed = z.input  (what authors write)
 *   EndpointDef     = z.output (what the compiler consumes)
 * `defineEndpoint(seed)` IS `parseSchema(zEndpointDef, seed)`. Identity
 * (id = "<provider>#<endpoint path minus its leading slash>") derives from
 * the `endpoint` field ?? request.path — folder names are ORGANIZATIONAL
 * only (design D22). minEngineVersion is compiler-derived — no author field.
 *
 * Every section except meta+request is OPTIONAL: it falls back leaf-wise to
 * the provider's identical section (endpoint ?? provider ?? config default),
 * so a minimal endpoint is just meta + request + input.schema. The compiler
 * enforces that url, auth.inject, and usage.compute resolve SOMEWHERE.
 */
export const zEndpointDef = z.strictObject({
  meta: zEndpointMeta,
  /** PUBLIC endpoint identity — a native path (see zEndpointPath).
   *  ABSENT ⇒ request.path with trailing slashes stripped (the default
   *  for plain HTTP providers). Declare it only when the native path is
   *  transport plumbing (apify: the actor slug path, mechanically
   *  derived from /v2/acts/{owner}~{name}/runs) or empty (tinyfish).
   *  Either way the resulting id is PUBLIC API — committed to
   *  connectors/ids.lock.json, so a drift (e.g. a vendor moving a
   *  route under a derived identity) fails `deno task ids:check`. */
  endpoint: zEndpointPath.optional(),
  request: zEndpointRequest,
  input: zInputSection.optional(),
  output: zOutputSection.optional(),
  usage: zUsageSection.optional(),
  auth: zAuthSection.optional(),
  timeouts: zTimeoutsSection.optional(),
  /** Async run protocol — when `start` resolves (endpoint ?? provider) the
   *  engine runs it INSTEAD of executing `request` itself; `request` stays
   *  required and travels into the fns as ctx.data.request. */
  lifecycle: zLifecycleSection.optional(),
  /** Endpoint↔resource bindings (design D32/D43) — PURPOSE-KEYED,
   *  ENDPOINT-ONLY, never provider-defaulted; presence unlocks
   *  `utils.resources`, the engine's ownership gates (canonical order
   *  uses→updates→releases→reads), the `data.resources[alias]`
   *  instance injection, and the settle marks. */
  resources: zResourcesSection.optional(),
})

export type EndpointDefSeed = z.input<typeof zEndpointDef>
export type EndpointDef = z.output<typeof zEndpointDef>

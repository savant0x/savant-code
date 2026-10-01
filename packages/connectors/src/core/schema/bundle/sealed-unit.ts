import { z } from 'zod'

import { zFnId } from '../common/ids.ts'
import { fnKeysOf, zEndpointDoc } from '../endpoint/doc.ts'
import { type FnEntry, zFnEntry } from '../fn-table/entry.ts'
import { providerFnKeysOf, zProviderDoc } from '../provider/doc.ts'
import { resourceFnKeysOf, zResourceDoc } from '../resource/doc.ts'

import type { Bundle } from './bundle.ts'

/**
 * SEALED UNIT ≠ EndpointDoc: the doc's slots hold `$fn` HASH REFERENCES, not
 * code — a doc alone cannot execute. A sealed unit is the doc PLUS exactly
 * the fn source entries it references: the statically-linked binary to the
 * doc's program-with-imports. Callers pass it BY VALUE into any engine —
 * another process, the hosted worker — and it executes with no other data.
 */
export const zSealedUnit = z.strictObject({
  doc: zEndpointDoc,
  fns: z.record(zFnId, zFnEntry),
})
export type SealedUnit = z.infer<typeof zSealedUnit>

/** Build a sealed unit for one endpoint out of a bundle (O(1) map lookup). */
export function sealUnit(bundle: Bundle, endpointId: string): SealedUnit {
  const doc = bundle.endpoints[endpointId]
  if (!doc) throw new Error(`endpoint not in bundle: ${endpointId}`)
  return { doc, fns: collectFns(bundle, fnKeysOf(doc), endpointId) }
}

/** A resource doc + exactly the fn entries it references — the same
 *  statically-linked posture for resource ops/billing/webhooks. */
export const zResourceSealedUnit = z.strictObject({
  doc: zResourceDoc,
  fns: z.record(zFnId, zFnEntry),
})
export type ResourceSealedUnit = z.infer<typeof zResourceSealedUnit>

export function sealResourceUnit(
  bundle: Bundle,
  resourceId: string,
): ResourceSealedUnit {
  const doc = (bundle.resources ?? {})[resourceId]
  if (!doc) throw new Error(`resource not in bundle: ${resourceId}`)
  return { doc, fns: collectFns(bundle, resourceFnKeysOf(doc), resourceId) }
}

/** A provider doc + its webhook fn entries — what the host ingress loads
 *  to verify + route provider-scope deliveries. */
export const zProviderSealedUnit = z.strictObject({
  doc: zProviderDoc,
  fns: z.record(zFnId, zFnEntry),
})
export type ProviderSealedUnit = z.infer<typeof zProviderSealedUnit>

export function sealProviderUnit(
  bundle: Bundle,
  provider: string,
): ProviderSealedUnit {
  const doc = bundle.providers[provider]
  if (!doc) throw new Error(`provider not in bundle: ${provider}`)
  return { doc, fns: collectFns(bundle, providerFnKeysOf(doc), provider) }
}

function collectFns(
  bundle: Bundle,
  keys: string[],
  owner: string,
): Record<string, FnEntry> {
  const fns: Record<string, FnEntry> = {}
  for (const key of keys) {
    const entry = bundle.fnTable[key]
    if (!entry) {
      throw new Error(`bundle missing fn entry ${key} for ${owner}`)
    }
    fns[key] = entry
  }
  return fns
}

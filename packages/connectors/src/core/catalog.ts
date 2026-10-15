import type { Bundle } from './schema/bundle/bundle.ts'
import type { EndpointDoc } from './schema/endpoint/doc.ts'
import type { ProviderMeta } from './schema/meta/provider.ts'
import type { ResourceDoc } from './schema/resource/doc.ts'
import type { LeafCategory } from './schema/taxonomy/leaf.ts'

/**
 * Bundle read API — pure functions over the Bundle shape core defines (no
 * engine, no compiler). Simple by design: listings spread the existing
 * shapes + a count; inspect returns the doc itself (it IS the contract).
 * Surfaced by `deno task catalog …`.
 */

function endpointsOf(bundle: Bundle, provider: string): EndpointDoc[] {
  return Object.values(bundle.endpoints).filter(
    (doc) => doc.provider === provider,
  )
}

export function listProviders(
  bundle: Bundle,
): (ProviderMeta & { name: string; endpointCount: number })[] {
  return Object.keys(bundle.providers)
    .sort()
    .map((name) => ({
      ...bundle.providers[name].meta,
      name,
      endpointCount: endpointsOf(bundle, name).length,
    }))
}

export interface EndpointFilter {
  provider?: string
  category?: string
}

export function listEndpoints(
  bundle: Bundle,
  filter: EndpointFilter = {},
): {
  id: string
  displayName: string
  summary: string
  categories: string[]
}[] {
  return Object.keys(bundle.endpoints)
    .sort()
    .map((id) => bundle.endpoints[id])
    .filter(
      (doc) =>
        filter.provider === undefined || doc.provider === filter.provider,
    )
    .filter(
      (doc) =>
        filter.category === undefined ||
        (doc.meta.categories ?? []).includes(filter.category),
    )
    .map((doc) => ({
      id: doc.id,
      displayName: doc.meta.displayName,
      summary: doc.meta.summary,
      categories: doc.meta.categories ?? [],
    }))
}

export function listCategories(
  bundle: Bundle,
): (LeafCategory & { endpointCount: number })[] {
  return bundle.taxonomy.leaves.map((leaf) => ({
    ...leaf,
    endpointCount: bundle.taxonomy.membership[leaf.id]?.length ?? 0,
  }))
}

/** The doc IS the endpoint's contract — return it as-is. */
export function inspectEndpoint(
  bundle: Bundle,
  endpointId: string,
): EndpointDoc {
  const doc = bundle.endpoints[endpointId]
  if (!doc) throw new Error(`endpoint not in bundle: ${endpointId}`)
  return doc
}

export function listResources(
  bundle: Bundle,
  filter: { provider?: string } = {},
): {
  id: string
  provider: string
  displayName: string
  summary: string
  billed: boolean
}[] {
  return Object.keys(bundle.resources ?? {})
    .sort()
    .map((id) => (bundle.resources ?? {})[id])
    .filter(
      (doc) =>
        filter.provider === undefined || doc.provider === filter.provider,
    )
    .map((doc) => ({
      id: doc.id,
      provider: doc.provider,
      displayName: doc.meta.displayName,
      summary: doc.meta.summary,
      billed: Object.values(doc.usage.lines).some(
        (line) => 'price' in line || line.consumes.amount > 0,
      ),
    }))
}

export function inspectResource(
  bundle: Bundle,
  resourceId: string,
): ResourceDoc {
  const doc = (bundle.resources ?? {})[resourceId]
  if (!doc) throw new Error(`resource not in bundle: ${resourceId}`)
  return doc
}

/** Authenticated River AI live model catalog (FID-2026-1017-015). */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { resolveProviderApiKey } from '../provider-credentials'
import { catalogCreated, catalogObject, catalogRows } from './catalog-values'
import { createLiveCatalogFetcher } from './live-catalog'
import { asOptionalString } from './wire-guards'

import type { OpenRouterModel } from './types'

const url = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'river')
if (!url)
  throw new Error(
    'river catalog must be configured as live in the provider registry',
  )

/** Preserve every upstream model id; River's catalog is the official roster. */
function parseRiverCatalog(json: unknown): OpenRouterModel[] {
  const parsed: OpenRouterModel[] = []
  for (const value of catalogRows(json)) {
    const row = catalogObject(value)
    const upstreamId = asOptionalString(row.id)
    if (!upstreamId) continue
    parsed.push({
      id: `river/${upstreamId}`,
      name: asOptionalString(row.name) ?? upstreamId,
      created: catalogCreated(row.created),
      provider: 'river',
    })
  }
  parsed.sort((a, b) => a.id.localeCompare(b.id))
  return parsed
}

const fetcher = createLiveCatalogFetcher<unknown>({
  url,
  logLabel: 'River AI',
  parse: parseRiverCatalog,
  resolveKey: () => resolveProviderApiKey('river'),
})

export const fetchRiverModels = fetcher.fetchModels
export const getCachedRiverModels = fetcher.getCachedModels
export const hasRiverCatalog = fetcher.hasCatalog
export const __resetRiverCacheForTest = fetcher.resetForTest

export function parseRiverModelsForTest(json: unknown): OpenRouterModel[] {
  return parseRiverCatalog(json)
}

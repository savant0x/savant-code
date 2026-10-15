/**
 * Live Venice AI model catalog (FID-2026-1012-026).
 *
 * Venice publishes a public OpenAI-shaped `data[]` list with
 * `context_length` on every measured row, so the filtered coding catalog is
 * the authoritative window source and no fallback rows are required.
 */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { isCodingHarnessModel } from './catalog-filter'
import {
  catalogCreated,
  catalogLimit,
  catalogObject,
  catalogRows,
} from './catalog-values'
import { createLiveCatalogFetcher } from './live-catalog'
import { asOptionalString } from './wire-guards'

import type { OpenRouterModel } from './types'

const url = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'venice')
if (!url)
  throw new Error(
    'venice catalog must be configured as live in the provider registry',
  )

function parseVeniceCatalog(json: unknown): OpenRouterModel[] {
  const parsed: OpenRouterModel[] = []
  for (const value of catalogRows(json)) {
    const row = catalogObject(value)
    const upstreamId = asOptionalString(row.id)
    if (!upstreamId) continue
    const name = asOptionalString(row.name) ?? upstreamId
    if (!isCodingHarnessModel(upstreamId, name)) continue
    parsed.push({
      id: `venice/${upstreamId}`,
      name,
      contextLength: catalogLimit(row.context_length),
      created: catalogCreated(row.created),
      provider: 'venice',
    })
  }
  parsed.sort((a, b) => a.id.localeCompare(b.id))
  return parsed
}

const fetcher = createLiveCatalogFetcher<unknown>({
  url,
  logLabel: 'Venice AI',
  parse: parseVeniceCatalog,
})

export const fetchVeniceModels = fetcher.fetchModels
export const getCachedVeniceModels = fetcher.getCachedModels
export const hasVeniceCatalog = fetcher.hasCatalog
export const __resetVeniceCacheForTest = fetcher.resetForTest

export function parseVeniceModelsForTest(json: unknown): OpenRouterModel[] {
  return parseVeniceCatalog(json)
}

/** Zylo AI public main text catalog; inference requires a key (FID-2026-1017-016). */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import {
  catalogLimit,
  catalogObject,
  catalogPrice,
  catalogStrings,
} from './catalog-values'
import { createLiveCatalogFetcher } from './live-catalog'
import { asOptionalString } from './wire-guards'

import type { OpenRouterModel } from './types'

const url = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'zylo')
if (!url) throw new Error('zylo catalog must be live in the provider registry')

/** The vendor's text array is authoritative even when capabilities are sparse. */
function parseZyloCatalog(json: unknown): OpenRouterModel[] {
  const text = catalogObject(json).text
  if (!Array.isArray(text)) return []
  const parsed: OpenRouterModel[] = []
  for (const value of text) {
    const row = catalogObject(value)
    const upstreamId = asOptionalString(row.id)
    if (!upstreamId) continue
    const pricing = catalogObject(row.pricing)
    parsed.push({
      id: `zylo/${upstreamId}`,
      name: asOptionalString(row.name) ?? upstreamId,
      description: asOptionalString(row.description),
      contextLength: catalogLimit(row.context_window),
      promptPricePerToken: catalogPrice(pricing.prompt),
      completionPricePerToken: catalogPrice(pricing.completion),
      capabilities: catalogStrings(row.capabilities),
      accessTier: asOptionalString(row.min_plan),
      provider: 'zylo',
    })
  }
  parsed.sort((a, b) => a.id.localeCompare(b.id))
  return parsed
}

const fetcher = createLiveCatalogFetcher<unknown>({
  url,
  logLabel: 'Zylo AI',
  parse: parseZyloCatalog,
})

export const fetchZyloModels = fetcher.fetchModels
export const getCachedZyloModels = fetcher.getCachedModels
export const hasZyloCatalog = fetcher.hasCatalog
export const __resetZyloCacheForTest = fetcher.resetForTest
export const parseZyloModelsForTest = parseZyloCatalog

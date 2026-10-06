/** Public live xKiro chat catalog; membership does not establish key access. */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { resolveProviderApiKey } from '../provider-credentials'
import {
  catalogLimit,
  catalogObject,
  catalogPrice,
  catalogRows,
  catalogStrings,
} from './catalog-values'
import { createLiveCatalogFetcher } from './live-catalog'
import { asOptionalString } from './wire-guards'

import type { OpenRouterModel } from './types'

function parseXkiroModel(value: unknown): OpenRouterModel | undefined {
  const row = catalogObject(value)
  const id = asOptionalString(row.id)
  if (!id || row.modality !== 'chat') return undefined
  const pricing = catalogObject(row.pricing)
  const usdPerMillion =
    pricing.currency === 'USD' && pricing.unit === 'per_1m_tokens'
  const capabilities = catalogObject(row.capabilities)
  const reasoning = catalogObject(row.reasoning_efforts)
  return {
    id: `xkiro/${id}`,
    name: asOptionalString(row.display_name) ?? id,
    contextLength: catalogLimit(row.context_length),
    maxCompletionTokens: catalogLimit(row.max_output_tokens),
    promptPricePerToken: usdPerMillion
      ? catalogPrice(pricing.input, 1_000_000)
      : undefined,
    completionPricePerToken: usdPerMillion
      ? catalogPrice(pricing.output, 1_000_000)
      : undefined,
    inputCacheReadPricePerToken: usdPerMillion
      ? catalogPrice(pricing.cache_read, 1_000_000)
      : undefined,
    capabilities: Object.entries(capabilities)
      .filter(([, supported]) => supported === true)
      .map(([capability]) => capability),
    accessTier: asOptionalString(row.access_tier),
    reasoningEfforts: row.reasoning_efforts
      ? {
          levels: catalogStrings(reasoning.levels),
          default: asOptionalString(reasoning.default),
        }
      : undefined,
    // The wire created:1 is a placeholder, so no creation date is asserted.
    provider: 'xkiro',
  }
}

export function parseXkiroModelsForTest(json: unknown): OpenRouterModel[] {
  const parsed: OpenRouterModel[] = []
  for (const row of catalogRows(json)) {
    const model = parseXkiroModel(row)
    if (model) parsed.push(model)
  }
  return parsed.sort((a, b) => a.id.localeCompare(b.id))
}

const url = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'xkiro')
if (!url)
  throw new Error(
    'xkiro catalog must be configured as live in the provider registry',
  )
const fetcher = createLiveCatalogFetcher({
  url,
  logLabel: 'xKiro',
  parse: parseXkiroModelsForTest,
  resolveKey: () => resolveProviderApiKey('xkiro'),
})

export const fetchXkiroModels = fetcher.fetchModels
export const getCachedXkiroModels = fetcher.getCachedModels
export const hasXkiroCatalog = fetcher.hasCatalog
export const __resetXkiroCacheForTest = fetcher.resetForTest

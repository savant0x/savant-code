/**
 * Live AIHubMix model catalog (FID-2026-1013-004).
 *
 * AIHubMix exposes a public rich catalog at `/api/v1/models` (probed
 * 2026-10-13: HTTP 200 / 869 rows). Its rows use `model_id`/`model_name`,
 * comma-delimited `types`/`features`, and `context_length`/`max_output`, so the
 * shared OpenRouter-shaped parser is not a compatible contract. The endpoint
 * is keyless; the catalog wrapper intentionally has no `resolveKey`, while
 * inference still requires AIHUBMIX_API_KEY through the registry factory.
 *
 * The `types` field is the measured inclusion boundary. Every retained row has
 * an exact `llm` token, including rows with empty `endpoints`; that field is
 * sparse and is not a safe exclusion predicate. Zero or missing limits remain
 * unknown through `catalogLimit` rather than becoming fabricated fallbacks.
 */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { catalogLimit, catalogObject, catalogRows } from './catalog-values'
import { createLiveCatalogFetcher } from './live-catalog'
import { asOptionalString } from './wire-guards'

import type { OpenRouterModel } from './types'

const url = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'aihubmix')
if (!url)
  throw new Error(
    'aihubmix catalog must be configured as live in the provider registry',
  )

function commaDelimitedValues(value: unknown): string[] {
  const text = asOptionalString(value)
  if (!text) return []
  return text
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

function parseAihubmixCatalog(json: unknown): OpenRouterModel[] {
  const parsed: OpenRouterModel[] = []
  for (const value of catalogRows(json)) {
    const row = catalogObject(value)
    const upstreamId = asOptionalString(row.model_id)
    const types = commaDelimitedValues(row.types)
    if (!upstreamId || !types.includes('llm')) continue

    const features = commaDelimitedValues(row.features)
    parsed.push({
      id: `aihubmix/${upstreamId}`,
      name: asOptionalString(row.model_name) ?? upstreamId,
      description: asOptionalString(row.desc),
      contextLength: catalogLimit(row.context_length),
      maxCompletionTokens: catalogLimit(row.max_output),
      capabilities: features.length > 0 ? features : undefined,
      provider: 'aihubmix',
    })
  }
  parsed.sort((a, b) => a.id.localeCompare(b.id))
  return parsed
}

const fetcher = createLiveCatalogFetcher<unknown>({
  url,
  logLabel: 'AIHubMix',
  parse: parseAihubmixCatalog,
})

export const fetchAihubmixModels = fetcher.fetchModels
export const getCachedAihubmixModels = fetcher.getCachedModels
export const hasAihubmixCatalog = fetcher.hasCatalog
export const __resetAihubmixCacheForTest = fetcher.resetForTest

/** Test-only parser seam for catalog contract tests without network access. */
export function parseAihubmixModelsForTest(json: unknown): OpenRouterModel[] {
  return parseAihubmixCatalog(json)
}

/**
 * Live DeepInfra model catalog (FID-2026-1012-026).
 *
 * The keyless sweep measured an OpenAI-shaped public `data[]` list with
 * org-prefixed ids and no window fields. The coding-compatible subset is
 * therefore public and live, while exact windows come from Tier 1 fallbacks.
 */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { isCodingHarnessModel } from './catalog-filter'
import { catalogObject, catalogRows } from './catalog-values'
import { createLiveCatalogFetcher } from './live-catalog'
import { asOptionalString } from './wire-guards'

import type { OpenRouterModel } from './types'

const url = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'deepinfra')
if (!url)
  throw new Error(
    'deepinfra catalog must be configured as live in the provider registry',
  )

function parseDeepInfraCatalog(json: unknown): OpenRouterModel[] {
  const parsed: OpenRouterModel[] = []
  for (const value of catalogRows(json)) {
    const row = catalogObject(value)
    const upstreamId = asOptionalString(row.id)
    if (!upstreamId) continue
    const name = asOptionalString(row.name) ?? upstreamId
    if (!isCodingHarnessModel(upstreamId, name)) continue
    parsed.push({
      id: `deepinfra/${upstreamId}`,
      name,
      provider: 'deepinfra',
    })
  }
  parsed.sort((a, b) => a.id.localeCompare(b.id))
  return parsed
}

const fetcher = createLiveCatalogFetcher<unknown>({
  url,
  logLabel: 'DeepInfra',
  parse: parseDeepInfraCatalog,
})

export const fetchDeepInfraModels = fetcher.fetchModels
export const getCachedDeepInfraModels = fetcher.getCachedModels
export const hasDeepInfraCatalog = fetcher.hasCatalog
export const __resetDeepInfraCacheForTest = fetcher.resetForTest

export function parseDeepInfraModelsForTest(json: unknown): OpenRouterModel[] {
  return parseDeepInfraCatalog(json)
}

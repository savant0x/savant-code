/**
 * Live KiosAPI model catalog.
 *
 * KiosAPI exposes an OpenAI-compatible authenticated `/v1/models` endpoint
 * (standard list shape: `{ object: 'list', data: [{ id, created, owned_by }] }`).
 * The shared live-catalog fetcher supplies bounded timeout, cache, in-flight
 * deduplication, stale-cache fallback, and redacted failure handling.
 *
 * The parser is pass-through over model entries: every id the key can access
 * is listed (including GLM/free variants) with the internal `kiosapi/` routing
 * prefix applied. No allowlist, no denylist, no modality filtering.
 */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { createLiveCatalogFetcher } from './live-catalog'

import type { OpenRouterModel } from './types'

const KIOSAPI_MODELS_URL = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'kiosapi')
if (!KIOSAPI_MODELS_URL) {
  throw new Error(
    'kiosapi catalog must be configured as live in the provider registry',
  )
}

type KiosapiModelsResponse = {
  data?: Array<{
    id?: unknown
    name?: unknown
    description?: unknown
    context_length?: unknown
    max_completion_tokens?: unknown
    created?: unknown
  }>
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * Normalize the `created` field. KiosAPI reports unix seconds (a number);
 * accept ISO strings defensively so the parser never drops an entry over it.
 */
function asOptionalCreated(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString()
  }
  return undefined
}

function parseKiosapiCatalog(json: KiosapiModelsResponse): OpenRouterModel[] {
  const parsed: OpenRouterModel[] = []
  for (const model of json.data ?? []) {
    const upstreamId = asOptionalString(model.id)
    if (!upstreamId) continue

    parsed.push({
      id: upstreamId.startsWith('kiosapi/')
        ? upstreamId
        : `kiosapi/${upstreamId}`,
      name: asOptionalString(model.name) ?? upstreamId,
      description: asOptionalString(model.description),
      contextLength: asOptionalNumber(model.context_length),
      maxCompletionTokens: asOptionalNumber(model.max_completion_tokens),
      created: asOptionalCreated(model.created),
      provider: 'kiosapi',
    })
  }
  parsed.sort((a, b) => a.id.localeCompare(b.id))
  return parsed
}

const fetcher = createLiveCatalogFetcher<KiosapiModelsResponse>({
  url: KIOSAPI_MODELS_URL,
  logLabel: 'KiosAPI',
  parse: parseKiosapiCatalog,
  resolveKey: () => process.env.KIOSAPI_API_KEY,
})

export const fetchKiosapiModels = fetcher.fetchModels
export const getCachedKiosapiModels = fetcher.getCachedModels
export const hasKiosapiCatalog = fetcher.hasCatalog
export const __resetKiosapiCacheForTest = fetcher.resetForTest

/** Test-only parser seam for catalog contract tests without network access. */
export function parseKiosapiModelsForTest(
  json: KiosapiModelsResponse,
): OpenRouterModel[] {
  return parseKiosapiCatalog(json)
}

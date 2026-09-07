/**
 * Live GoRouter model catalog.
 *
 * GoRouter is a "New API" instance (open-source unified AI gateway) exposing
 * an OpenAI-compatible authenticated `/v1/models` endpoint (standard list
 * shape; live-probed 2026-09-06 — 401 `new_api_error` without a key). The
 * shared live-catalog fetcher supplies bounded timeout, cache, in-flight
 * deduplication, stale-cache fallback, and redacted failure handling.
 *
 * The parser is pass-through over model entries: every id the key can access
 * is listed (including GLM/free variants) with the internal `gorouter/`
 * routing prefix applied. No allowlist, no denylist, no modality filtering.
 */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { createLiveCatalogFetcher } from './live-catalog'

import type { OpenRouterModel } from './types'

const GOROUTER_MODELS_URL = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'gorouter')
if (!GOROUTER_MODELS_URL) {
  throw new Error(
    'gorouter catalog must be configured as live in the provider registry',
  )
}

type GorouterModelsResponse = {
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
 * Normalize the `created` field. New API reports unix seconds (a number);
 * accept ISO strings defensively so the parser never drops an entry over it.
 */
function asOptionalCreated(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString()
  }
  return undefined
}

function parseGorouterCatalog(json: GorouterModelsResponse): OpenRouterModel[] {
  const parsed: OpenRouterModel[] = []
  for (const model of json.data ?? []) {
    const upstreamId = asOptionalString(model.id)
    if (!upstreamId) continue

    parsed.push({
      id: upstreamId.startsWith('gorouter/')
        ? upstreamId
        : `gorouter/${upstreamId}`,
      name: asOptionalString(model.name) ?? upstreamId,
      description: asOptionalString(model.description),
      contextLength: asOptionalNumber(model.context_length),
      maxCompletionTokens: asOptionalNumber(model.max_completion_tokens),
      created: asOptionalCreated(model.created),
      provider: 'gorouter',
    })
  }
  parsed.sort((a, b) => a.id.localeCompare(b.id))
  return parsed
}

const fetcher = createLiveCatalogFetcher<GorouterModelsResponse>({
  url: GOROUTER_MODELS_URL,
  logLabel: 'GoRouter',
  parse: parseGorouterCatalog,
  resolveKey: () => process.env.GOROUTER_API_KEY,
})

export const fetchGorouterModels = fetcher.fetchModels
export const getCachedGorouterModels = fetcher.getCachedModels
export const hasGorouterCatalog = fetcher.hasCatalog
export const __resetGorouterCacheForTest = fetcher.resetForTest

/** Test-only parser seam for catalog contract tests without network access. */
export function parseGorouterModelsForTest(
  json: GorouterModelsResponse,
): OpenRouterModel[] {
  return parseGorouterCatalog(json)
}

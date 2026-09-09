/**
 * Live APInex model catalog (FID-2026-0907-008).
 *
 * APInex exposes an authenticated OpenAI-compatible `/v1/models` endpoint
 * (contract: https://apinex.bond/llms.txt). The shared live-catalog fetcher
 * supplies bounded timeout, cache, in-flight deduplication, stale-cache
 * fallback, and redacted failure handling.
 */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { createLiveCatalogFetcher } from './live-catalog'

import type { OpenRouterModel } from './types'

const APINEX_MODELS_URL = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'apinex')
if (!APINEX_MODELS_URL) {
  throw new Error(
    'apinex catalog must be configured as live in the provider registry',
  )
}

type ApinexModelsResponse = {
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

function parseApinexCatalog(json: ApinexModelsResponse): OpenRouterModel[] {
  const parsed: OpenRouterModel[] = []
  for (const model of json.data ?? []) {
    const upstreamId = asOptionalString(model.id)
    if (!upstreamId) continue

    // Upstream ids are vendor-namespaced WITH slashes (gpt/5.6-luna);
    // the internal `apinex/` routing prefix is added exactly once here
    // and stripped before the chat request (idTransform: 'strip').
    const id = upstreamId.startsWith('apinex/')
      ? upstreamId
      : `apinex/${upstreamId}`
    parsed.push({
      id,
      name: asOptionalString(model.name) ?? upstreamId,
      description: asOptionalString(model.description),
      contextLength: asOptionalNumber(model.context_length),
      maxCompletionTokens: asOptionalNumber(model.max_completion_tokens),
      created: asOptionalString(model.created),
      provider: 'apinex',
    })
  }
  parsed.sort((a, b) => a.id.localeCompare(b.id))
  return parsed
}

const fetcher = createLiveCatalogFetcher<ApinexModelsResponse>({
  url: APINEX_MODELS_URL,
  logLabel: 'APInex',
  parse: parseApinexCatalog,
  resolveKey: () => process.env.APINEX_API_KEY,
})

export const fetchApinexModels = fetcher.fetchModels
export const getCachedApinexModels = fetcher.getCachedModels
export const hasApinexCatalog = fetcher.hasCatalog
export const __resetApinexCacheForTest = fetcher.resetForTest

/** Test-only parser seam for catalog contract tests without network access. */
export function parseApinexModelsForTest(
  json: ApinexModelsResponse,
): OpenRouterModel[] {
  return parseApinexCatalog(json)
}

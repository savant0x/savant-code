/**
 * OpenCode Zen — public /v1/models endpoint (no auth required for listing).
 *
 * Thin wrapper over the generic live-catalog fetcher (FID-2026-0809-001
 * Phase 3 pattern; FID-2026-0905-003). Degrades to an empty list on failure;
 * never throws. The parser is pass-through over model entries: every id the
 * endpoint returns is listed (including GLM/free variants) with the internal
 * `opencode-zen/` routing prefix applied. Per-model wire protocols live in
 * OPENCODE_ZEN_PROTOCOLS — the catalog carries ids, not endpoints.
 */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { createLiveCatalogFetcher } from './live-catalog'

import type { OpenRouterModel } from './types'

const ZEN_MODELS_URL = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'opencode-zen')
if (!ZEN_MODELS_URL) {
  throw new Error(
    'opencode-zen catalog must be configured as live in the provider registry',
  )
}

type ZenModelsResponse = {
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
 * Normalize the `created` field. Zen reports unix seconds (a number);
 * accept ISO strings defensively so the parser never drops an entry over it.
 */
function asOptionalCreated(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString()
  }
  return undefined
}

function parseZenCatalog(json: ZenModelsResponse): OpenRouterModel[] {
  const parsed: OpenRouterModel[] = []
  for (const model of json.data ?? []) {
    const upstreamId = asOptionalString(model.id)
    if (!upstreamId) continue

    parsed.push({
      id: upstreamId.startsWith('opencode-zen/')
        ? upstreamId
        : `opencode-zen/${upstreamId}`,
      name: asOptionalString(model.name) ?? upstreamId,
      description: asOptionalString(model.description),
      contextLength: asOptionalNumber(model.context_length),
      maxCompletionTokens: asOptionalNumber(model.max_completion_tokens),
      created: asOptionalCreated(model.created),
      provider: 'opencode-zen',
    })
  }
  parsed.sort((a, b) => a.id.localeCompare(b.id))
  return parsed
}

const fetcher = createLiveCatalogFetcher<ZenModelsResponse>({
  url: ZEN_MODELS_URL,
  logLabel: 'OpenCode Zen',
  parse: parseZenCatalog,
})

export const fetchZenModels = fetcher.fetchModels
export const getCachedZenModels = fetcher.getCachedModels
export const hasZenCatalog = fetcher.hasCatalog
export const __resetZenCacheForTest = fetcher.resetForTest

/** Test-only parser seam for catalog contract tests without network access. */
export function parseZenModelsForTest(
  json: ZenModelsResponse,
): OpenRouterModel[] {
  return parseZenCatalog(json)
}

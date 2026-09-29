/**
 * NVIDIA NIM — public /v1/models endpoint (no auth required for listing).
 *
 * FID-2026-0809-001 Phase 3: thin wrapper over the generic live-catalog
 * fetcher. Degrades to an empty list on failure; never throws.
 */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { createLiveCatalogFetcher } from './live-catalog'

import type { NvidiaModelsResponse, OpenRouterModel } from './types'

// Catalog endpoint comes from the registry — single source of truth (Phase 3).
const NVIDIA_MODELS_URL = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'nvidia')
if (!NVIDIA_MODELS_URL) {
  throw new Error(
    'nvidia catalog must be configured as live in the provider registry',
  )
}

function parseNvidiaCatalog(json: NvidiaModelsResponse): OpenRouterModel[] {
  const models: OpenRouterModel[] = (json.data ?? [])
    .filter((m): m is { id: string } => !!m.id)
    .map((m) => ({
      id: `nvidia/${m.id}`,
      name: m.id,
      provider: 'nvidia' as const,
    }))
  models.sort((a, b) => a.id.localeCompare(b.id))
  return models
}

const fetcher = createLiveCatalogFetcher({
  url: NVIDIA_MODELS_URL,
  logLabel: 'NVIDIA NIM',
  parse: parseNvidiaCatalog,
})

/**
 * Fetch available models from NVIDIA NIM's public /v1/models endpoint.
 * Returns a cached copy when fresh; degrades to empty list on failure.
 * Never throws.
 */
export const fetchNvidiaModels = fetcher.fetchModels

/** Synchronous read of the cached NVIDIA catalog (or empty). */
export const getCachedNvidiaModels = fetcher.getCachedModels

/** Test-only parser seam for catalog contract tests without network access. */
export function parseNvidiaModelsForTest(
  json: NvidiaModelsResponse,
): OpenRouterModel[] {
  return parseNvidiaCatalog(json)
}

/** Test-only: clear the NVIDIA cache + in-flight request. */
export const __resetNvidiaCacheForTest = fetcher.resetForTest

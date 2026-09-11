/**
 * Generic custom-provider model catalog (FID-2026-0910-004 Step 9 remainder).
 *
 * One module serves EVERY registered custom provider (Law 13): per-id live
 * fetchers are built lazily from the effective registry, reusing the shared
 * `createLiveCatalogFetcher` (bounded timeout, cache/TTL, in-flight dedup,
 * stale-cache fallback, redacted failure logging — identical semantics to the
 * built-in live catalogs). Inline catalogs are pure synthesis; `none` and
 * unknown ids return [] fail-closed (Law 14 — nothing silently present).
 *
 * D10 degradation ladder: a failed live fetch degrades to [] (callers fall
 * back to free-text `/model <exact-id>`, which routes through the effective
 * registry and never depends on the catalog). A custom catalog failure is
 * isolated by the gateway merge's allSettled and never masks built-ins.
 */
import { getEffectiveProviderRegistry } from '@savant-code/common/providers/custom-providers'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { readStoredProviderKeys } from '../provider-credentials'
import { createLiveCatalogFetcher } from './live-catalog'

import type { OpenRouterModel } from './types'
import type { CustomProviderConfig } from '@savant-code/common/providers/types'

type CustomLiveCatalogResponse = {
  data?: Array<{
    id?: unknown
    name?: unknown
    description?: unknown
    context_length?: unknown
    max_completion_tokens?: unknown
  }>
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined
}

/** Parse an OpenAI-compatible /v1/models body into prefixed models. */
function parseCustomCatalogJson(
  json: CustomLiveCatalogResponse,
  providerId: string,
): OpenRouterModel[] {
  const prefix = `${providerId}/`
  const parsed: OpenRouterModel[] = []
  for (const model of json.data ?? []) {
    const upstreamId = asOptionalString(model.id)
    if (!upstreamId) continue

    parsed.push({
      id: upstreamId.startsWith(prefix) ? upstreamId : `${prefix}${upstreamId}`,
      name: asOptionalString(model.name) ?? upstreamId,
      description: asOptionalString(model.description),
      contextLength: asOptionalNumber(model.context_length),
      maxCompletionTokens: asOptionalNumber(model.max_completion_tokens),
      provider: providerId,
    })
  }
  parsed.sort((a, b) => a.id.localeCompare(b.id))
  return parsed
}

/** Lazily-built per-custom-id live fetchers (rebuilt after re-registration). */
const customFetchers = new Map<
  string,
  ReturnType<typeof createLiveCatalogFetcher<CustomLiveCatalogResponse>>
>()

function getCustomCatalog(
  providerId: string,
): CustomProviderConfig | undefined {
  const entry = getEffectiveProviderRegistry()[providerId]
  if (!entry) return undefined
  return {
    id: entry.id,
    label: entry.label,
    baseUrl: entry.baseUrl,
    apiKeyEnvVar: entry.credentials.envVar ?? '',
    catalog: entry.catalog as CustomProviderConfig['catalog'],
  }
}

/** Build (or reuse) the live fetcher for a custom id. */
function getCustomFetcher(
  providerId: string,
  url: string,
  apiKeyEnvVar: string,
): ReturnType<typeof createLiveCatalogFetcher<CustomLiveCatalogResponse>> {
  const existing = customFetchers.get(providerId)
  if (existing) return existing
  const fetcher = createLiveCatalogFetcher<CustomLiveCatalogResponse>({
    url,
    logLabel: `custom provider '${providerId}'`,
    parse: (json) => parseCustomCatalogJson(json, providerId),
    resolveKey: () => {
      // Shell env first (higher precedence), then the persisted 0600 store —
      // the same precedence the generic credential read applies. The import
      // is static and side-effect-free; the file is only read when a custom
      // live fetch actually resolves a key.
      const env = process.env[apiKeyEnvVar]?.trim()
      if (env) return env
      return readStoredProviderKeys()[apiKeyEnvVar]
    },
  })
  customFetchers.set(providerId, fetcher)
  return fetcher
}

/** Synthesize inline catalog entries (no network, pure). */
function synthesizeInline(
  providerId: string,
  models: Record<string, string>,
): OpenRouterModel[] {
  return Object.entries(models)
    .map(([id, name]) => ({ id, name, provider: providerId }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Fetch the model catalog for one custom provider id. Returns [] for
 * `none`/unknown/built-in ids without any network access.
 */
export async function fetchCustomModels(
  providerId: string,
  forceRefresh = false,
): Promise<OpenRouterModel[]> {
  if (providerId in PROVIDER_REGISTRY) return []
  const config = getCustomCatalog(providerId)
  if (!config) return []
  if (config.catalog.source === 'inline') {
    return synthesizeInline(providerId, config.catalog.models)
  }
  if (config.catalog.source === 'live') {
    return getCustomFetcher(
      providerId,
      config.catalog.url,
      config.apiKeyEnvVar,
    ).fetchModels(forceRefresh)
  }
  return []
}

/** All custom ids registered in the effective view (merge seam). */
export function getCustomProviderIds(): string[] {
  return Object.keys(getEffectiveProviderRegistry()).filter(
    (id) => !(id in PROVIDER_REGISTRY),
  )
}

/**
 * Fetch every registered custom catalog and merge the results (called from
 * the gateway combiner). Individual failures degrade to [] per provider.
 */
export async function fetchAllCustomModels(
  forceRefresh = false,
): Promise<OpenRouterModel[]> {
  const results = await Promise.allSettled(
    getCustomProviderIds().map((id) => fetchCustomModels(id, forceRefresh)),
  )
  const merged: OpenRouterModel[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') merged.push(...result.value)
  }
  return merged
}

/** Test-only: drop all lazily-built custom fetchers (cache reset seam). */
export function __resetCustomCatalogsForTest(): void {
  customFetchers.clear()
}

/**
 * Live OpenRouter model catalog.
 *
 * FID-2026-0809-001 Phase 3: thin wrapper over the generic live-catalog
 * fetcher. OpenRouter's model list changes frequently, so rather than
 * hardcoding a stale table we fetch the current catalog from their public API.
 * The result is cached per-process with a short TTL so the /model picker stays
 * current without hammering the endpoint. The catalog request authenticates
 * with the resolved OpenRouter key (master-key exchange chain) when one is
 * available (adversarial finding 10). On any failure the picker falls back to
 * free-text entry of an exact model id.
 */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'
import { resolveOpenRouterApiKey } from '@savant-code/sdk'

import { createLiveCatalogFetcher } from './live-catalog'

import type { OpenRouterModel, OpenRouterModelsResponse } from './types'

// Catalog endpoint comes from the registry — single source of truth (Phase 3).
const OPENROUTER_MODELS_URL = deriveLiveCatalogUrl(
  PROVIDER_REGISTRY,
  'openrouter',
)
if (!OPENROUTER_MODELS_URL) {
  throw new Error(
    'openrouter catalog must be configured as live in the provider registry',
  )
}

/**
 * Coerce a wire numeric that may be `null` down to `number | undefined`.
 *
 * Measured 2026-09-27: OpenRouter sends `context_length: null` and
 * `max_completion_tokens: null` under `top_provider` for routed/resold models
 * (e.g. `typesafe/jev-router`). Passing that `null` straight through would put
 * a value the internal type forbids into `OpenRouterModel`, and every consumer
 * would have to re-guard. `lookup.ts` already does guard with `typeof`, but the
 * boundary is the right place to normalize — same rule as the cleanapis parser.
 */
function asOptionalNumber(
  value: number | null | undefined,
): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function parseCatalog(json: OpenRouterModelsResponse): OpenRouterModel[] {
  const models = json.data ?? []
  const parsed: OpenRouterModel[] = []
  for (const m of models) {
    if (!m.id) continue
    const prompt = m.pricing?.prompt
    const completion = m.pricing?.completion
    const inputCacheRead = m.pricing?.input_cache_read
    const webSearch = m.pricing?.web_search
    parsed.push({
      id: m.id,
      name: m.name ?? m.id,
      description: m.description,
      contextLength: m.context_length,
      maxCompletionTokens: m.max_completion_tokens,
      promptPricePerToken: prompt !== undefined ? Number(prompt) : undefined,
      completionPricePerToken:
        completion !== undefined ? Number(completion) : undefined,
      inputCacheReadPricePerToken:
        inputCacheRead !== undefined ? Number(inputCacheRead) : undefined,
      webSearchPricePerToken:
        webSearch !== undefined ? Number(webSearch) : undefined,
      provider: undefined,
      // Nested first, flat second. Measured 2026-09-27 against the live
      // catalog (HTTP 200, 458 models): `architecture.*` is present on 458/458
      // while the flat `modality`/`tokenizer`/`instruct_type` keys are populated
      // on **0/458**. So the flat read — the only one this parser had until now
      // — yielded `undefined` for every model, and `model-info.ts` rendered no
      // modalities line for any of them. The flat fallback is retained because
      // the public schema still declares those keys and cached responses or
      // other gateways may send them.
      modality: m.architecture?.modality ?? m.modality,
      tokenizer: m.architecture?.tokenizer ?? m.tokenizer,
      instructType:
        m.architecture?.instruct_type ?? m.instruct_type ?? undefined,
      knowledgeCutoff: m.knowledge_cutoff,
      created: m.created,
      reasoning: m.reasoning,
      topProvider: m.top_provider
        ? {
            contextLength: asOptionalNumber(m.top_provider.context_length),
            maxCompletionTokens: asOptionalNumber(
              m.top_provider.max_completion_tokens,
            ),
            isModerated: m.top_provider.is_moderated,
          }
        : undefined,
      benchmarks: m.benchmarks,
      links: m.links,
    })
  }
  // Stable, predictable order for the picker.
  parsed.sort((a, b) => a.id.localeCompare(b.id))
  return parsed
}

const fetcher = createLiveCatalogFetcher({
  url: OPENROUTER_MODELS_URL,
  logLabel: 'OpenRouter',
  parse: parseCatalog,
  resolveKey: () => resolveOpenRouterApiKey(),
})

/**
 * Fetch the live OpenRouter model catalog.
 *
 * Returns a cached copy when fresh; otherwise fetches and caches. Concurrent
 * callers share a single in-flight request. On failure, returns the last good
 * cache if available, else an empty list — callers must handle empty as
 * "show free-text entry". Never throws.
 */
export const fetchOpenRouterModels = fetcher.fetchModels

/**
 * Synchronous read of the current catalog (cached or empty).
 * Use this for rendering the picker immediately; call
 * {@link fetchOpenRouterModels} to populate/refresh it.
 */
export const getCachedOpenRouterModels = fetcher.getCachedModels

/** Whether a live catalog has been loaded at least once. */
export const hasOpenRouterCatalog = fetcher.hasCatalog

/** Test-only: clear the OpenRouter catalog cache + in-flight request. */
export const __resetOpenRouterCacheForTest = fetcher.resetForTest

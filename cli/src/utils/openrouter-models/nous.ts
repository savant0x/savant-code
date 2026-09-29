/**
 * Live Nous Research model catalog.
 *
 * Nous exposes an OpenAI-compatible `/v1/models` endpoint. The shared
 * live-catalog fetcher supplies bounded timeout, cache, in-flight
 * deduplication, stale-cache fallback, and redacted failure handling.
 *
 * **Wire shape, measured 2026-09-27** (keyless, HTTP 200, 417 models): Nous is
 * an OpenRouter-shaped dialect, so `architecture.*`, `top_provider` and
 * `pricing` are all present on 417/417, while the flat `modality` / `tokenizer`
 * / `instruct_type` keys are populated on **0/417**. Before this mapping the
 * parser read six fields and ignored all three of those, so every Nous model
 * rendered with no modalities line, no prices, and an unpopulated
 * `topProvider` — even though `top_provider.context_length` (36864) and
 * `max_completion_tokens` (8192) carry real numbers here, unlike OpenRouter
 * where they are `null` for routed models.
 */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { createLiveCatalogFetcher } from './live-catalog'
import { asOptionalNumber, asOptionalString } from './wire-guards'

import type { OpenRouterModel } from './types'

const NOUS_MODELS_URL = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'nous')
if (!NOUS_MODELS_URL) {
  throw new Error(
    'nous catalog must be configured as live in the provider registry',
  )
}

type NousModelsResponse = {
  data?: Array<{
    id?: unknown
    name?: unknown
    description?: unknown
    context_length?: unknown
    max_completion_tokens?: unknown
    created?: unknown
    architecture?: {
      modality?: unknown
      input_modalities?: unknown
      output_modalities?: unknown
      tokenizer?: unknown
      instruct_type?: unknown
    }
    pricing?: {
      prompt?: unknown
      completion?: unknown
    }
    top_provider?: {
      context_length?: unknown
      max_completion_tokens?: unknown
      is_moderated?: unknown
    }
  }>
}

/**
 * Pricing arrives as a decimal STRING (`"0.0000001500"`), matching OpenRouter's
 * wire shape. Non-numeric text coerces to `NaN` and is rejected, so a malformed
 * price degrades to "price not shown" rather than rendering `NaN`.
 */
function asOptionalPrice(value: unknown): number | undefined {
  if (typeof value === 'number') return asOptionalNumber(value)
  if (typeof value !== 'string' || value.length === 0) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseNousCatalog(json: NousModelsResponse): OpenRouterModel[] {
  const parsed: OpenRouterModel[] = []
  for (const model of json.data ?? []) {
    const upstreamId = asOptionalString(model.id)
    if (!upstreamId) continue

    parsed.push({
      id: upstreamId.startsWith('nous/') ? upstreamId : `nous/${upstreamId}`,
      name: asOptionalString(model.name) ?? upstreamId,
      description: asOptionalString(model.description),
      contextLength: asOptionalNumber(model.context_length),
      maxCompletionTokens: asOptionalNumber(model.max_completion_tokens),
      promptPricePerToken: asOptionalPrice(model.pricing?.prompt),
      completionPricePerToken: asOptionalPrice(model.pricing?.completion),
      modality: asOptionalString(model.architecture?.modality),
      tokenizer: asOptionalString(model.architecture?.tokenizer),
      instructType: asOptionalString(model.architecture?.instruct_type),
      topProvider: model.top_provider
        ? {
            contextLength: asOptionalNumber(model.top_provider.context_length),
            maxCompletionTokens: asOptionalNumber(
              model.top_provider.max_completion_tokens,
            ),
            isModerated:
              typeof model.top_provider.is_moderated === 'boolean'
                ? model.top_provider.is_moderated
                : undefined,
          }
        : undefined,
      created: asOptionalString(model.created),
      provider: 'nous',
    })
  }
  parsed.sort((a, b) => a.id.localeCompare(b.id))
  return parsed
}

const fetcher = createLiveCatalogFetcher<NousModelsResponse>({
  url: NOUS_MODELS_URL,
  logLabel: 'Nous Research',
  parse: parseNousCatalog,
  resolveKey: () => process.env.NOUS_API_KEY,
})

export const fetchNousModels = fetcher.fetchModels
export const getCachedNousModels = fetcher.getCachedModels
export const hasNousCatalog = fetcher.hasCatalog
export const __resetNousCacheForTest = fetcher.resetForTest

/** Test-only parser seam for catalog contract tests without network access. */
export function parseNousModelsForTest(
  json: NousModelsResponse,
): OpenRouterModel[] {
  return parseNousCatalog(json)
}

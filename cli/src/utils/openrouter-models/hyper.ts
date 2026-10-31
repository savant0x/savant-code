/**
 * Live Hyper (Charm) model catalog (FID-2026-1030-004).
 *
 * The vendor exposes a PUBLIC OpenAI-compatible `/v1/models` endpoint
 * (contract: https://hyper.charm.land/docs/api/list-models, read 2026-10-30;
 * probed HTTP 200 keyless, 23 rows, 2026-10-30). The shared live-catalog
 * fetcher supplies the bounded timeout, in-flight dedup, cache and
 * degrade-to-cache semantics — no resolver, because the catalog needs no key.
 *
 * The row shape is NOT the OpenRouter shape: ids are bare (no vendor
 * namespace), names arrive as `display_name`, limits as
 * `context_window`/`max_output_tokens`, and pricing is per MILLION tokens.
 * Copying an OpenRouter-shaped parser would silently drop every window.
 */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import {
  catalogLimit,
  catalogObject,
  catalogPrice,
  catalogRows,
  catalogStrings,
} from './catalog-values'
import { createLiveCatalogFetcher } from './live-catalog'
import { asOptionalString } from './wire-guards'

import type { OpenRouterModel } from './types'

const HYPER_MODELS_URL = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'hyper')
if (!HYPER_MODELS_URL) {
  throw new Error(
    'hyper catalog must be configured as live in the provider registry',
  )
}

type HyperModelsResponse = { data?: unknown }

/**
 * Vendor-reported reasoning controls: `effort_levels` is an array of
 * `{ value, display }` records, not a string list.
 */
function reasoningEfforts(
  reasoning: Record<string, unknown>,
): OpenRouterModel['reasoningEfforts'] {
  const levels = Array.isArray(reasoning.effort_levels)
    ? reasoning.effort_levels
        .map((level) => asOptionalString(catalogObject(level).value))
        .filter((level): level is string => level !== undefined)
    : []
  const fallback = asOptionalString(reasoning.default_effort_level)
  if (levels.length === 0 && fallback === undefined) return undefined
  return {
    ...(levels.length > 0 ? { levels } : {}),
    ...(fallback !== undefined ? { default: fallback } : {}),
  }
}

/** Vendor capability badges: `capabilities.vision` boolean plus the reasoning block. */
function capabilities(row: Record<string, unknown>): string[] | undefined {
  const flags = catalogStrings(row.capabilities)
  if (flags !== undefined) return flags
  const declared = catalogObject(row.capabilities)
  const badges: string[] = []
  if (declared.vision === true) badges.push('vision')
  if (Object.keys(catalogObject(row.reasoning)).length > 0) {
    badges.push('reasoning')
  }
  return badges.length > 0 ? badges : undefined
}

export function parseHyperModels(json: unknown): OpenRouterModel[] {
  const parsed: OpenRouterModel[] = []
  for (const value of catalogRows(json)) {
    const row = catalogObject(value)
    const id = asOptionalString(row.id)
    if (!id) continue
    const pricing = catalogObject(row.pricing)
    parsed.push({
      // Upstream ids are bare (`deepseek-v4.1-flash`), so the internal id gains
      // exactly one `hyper/` routing prefix and `idTransform: 'strip'` removes
      // it again on the wire.
      id: `hyper/${id}`,
      name: asOptionalString(row.display_name) ?? id,
      contextLength: catalogLimit(row.context_window),
      maxCompletionTokens: catalogLimit(row.max_output_tokens),
      promptPricePerToken: catalogPrice(pricing.input, 1_000_000),
      completionPricePerToken: catalogPrice(pricing.output, 1_000_000),
      inputCacheReadPricePerToken: catalogPrice(pricing.cache_hit, 1_000_000),
      capabilities: capabilities(row),
      reasoningEfforts: reasoningEfforts(catalogObject(row.reasoning)),
      provider: 'hyper',
    })
  }
  return parsed.sort((a, b) => a.id.localeCompare(b.id))
}

const fetcher = createLiveCatalogFetcher<HyperModelsResponse>({
  url: HYPER_MODELS_URL,
  logLabel: 'Hyper',
  parse: parseHyperModels,
})

export const fetchHyperModels = fetcher.fetchModels
export const getCachedHyperModels = fetcher.getCachedModels
export const hasHyperCatalog = fetcher.hasCatalog
export const __resetHyperCacheForTest = fetcher.resetForTest

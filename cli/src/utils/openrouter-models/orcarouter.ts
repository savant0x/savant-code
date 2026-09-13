/**
 * Live OrcaRouter model catalog (FID-2026-0911-002).
 *
 * OrcaRouter exposes a PUBLIC OpenAI-compatible `/v1/models` endpoint
 * (contract: https://docs.orcarouter.ai/introduction — "Point your existing
 * OpenAI SDK at https://api.orcarouter.ai/v1"; probed HTTP 200 keyless).
 * The shared live-catalog fetcher supplies bounded timeout, cache, in-flight
 * deduplication, stale-cache fallback, and redacted failure handling — no
 * resolver wire-in because the catalog needs no auth.
 */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { createLiveCatalogFetcher } from './live-catalog'

import type { OpenRouterModel } from './types'

const ORCAROUTER_MODELS_URL = deriveLiveCatalogUrl(
  PROVIDER_REGISTRY,
  'orcarouter',
)
if (!ORCAROUTER_MODELS_URL) {
  throw new Error(
    'orcarouter catalog must be configured as live in the provider registry',
  )
}

type OrcarouterModelsResponse = {
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

function parseOrcarouterCatalog(
  json: OrcarouterModelsResponse,
): OpenRouterModel[] {
  const parsed: OpenRouterModel[] = []
  for (const model of json.data ?? []) {
    const upstreamId = asOptionalString(model.id)
    if (!upstreamId) continue

    // Upstream ids are MIXED: vendor models are vendor-namespaced WITH
    // slashes (anthropic/claude-opus-5, deepseek/deepseek-v4-flash) while
    // OrcaRouter's own routers already carry the prefix (orcarouter/free,
    // orcarouter/fusion). Prefix UNIFORMLY — every internal id gains
    // exactly one `orcarouter/` routing prefix, INCLUDING ids that already
    // start with `orcarouter/`. This is load-bearing: the wire id must
    // equal the upstream catalog id, and idTransform: 'strip' removes
    // exactly one segment — so `orcarouter/orcarouter/free` → wire
    // `orcarouter/free` (upstream) and `orcarouter/anthropic/claude-opus-5`
    // → wire `anthropic/claude-opus-5` (upstream). A passthrough branch
    // (apinex-style) would send bare `free` for the routers — un-routable.
    // (The nous/apinex passthrough branches are inert: no upstream id
    // carries those prefixes.)
    const id = `orcarouter/${upstreamId}`
    parsed.push({
      id,
      name: asOptionalString(model.name) ?? upstreamId,
      description: asOptionalString(model.description),
      contextLength: asOptionalNumber(model.context_length),
      maxCompletionTokens: asOptionalNumber(model.max_completion_tokens),
      created: asOptionalString(model.created),
      provider: 'orcarouter',
    })
  }
  parsed.sort((a, b) => a.id.localeCompare(b.id))
  return parsed
}

const fetcher = createLiveCatalogFetcher<OrcarouterModelsResponse>({
  url: ORCAROUTER_MODELS_URL,
  logLabel: 'OrcaRouter',
  parse: parseOrcarouterCatalog,
})

export const fetchOrcarouterModels = fetcher.fetchModels
export const getCachedOrcarouterModels = fetcher.getCachedModels
export const hasOrcarouterCatalog = fetcher.hasCatalog
export const __resetOrcarouterCacheForTest = fetcher.resetForTest

/** Test-only parser seam for catalog contract tests without network access. */
export function parseOrcarouterModelsForTest(
  json: OrcarouterModelsResponse,
): OpenRouterModel[] {
  return parseOrcarouterCatalog(json)
}

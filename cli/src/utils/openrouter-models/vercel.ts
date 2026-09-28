/**
 * Live Vercel AI Gateway model catalog (FID-2026-0927-001).
 *
 * The gateway exposes a PUBLIC OpenAI-compatible `/v1/models` endpoint
 * (contract: https://vercel.com/docs/ai-gateway; probed HTTP 200 keyless,
 * 391 models, 2026-09-27). The shared live-catalog fetcher supplies bounded
 * timeout, cache, in-flight deduplication, stale-cache fallback, and redacted
 * failure handling — no resolver wire-in because the catalog needs no auth.
 */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { createLiveCatalogFetcher } from './live-catalog'

import type { OpenRouterModel } from './types'

const VERCEL_MODELS_URL = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'vercel')
if (!VERCEL_MODELS_URL) {
  throw new Error(
    'vercel catalog must be configured as live in the provider registry',
  )
}

type VercelModelsResponse = {
  data?: Array<{
    id?: unknown
    name?: unknown
    description?: unknown
    context_window?: unknown
    max_tokens?: unknown
    created?: unknown
  }>
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function parseVercelCatalog(json: VercelModelsResponse): OpenRouterModel[] {
  const parsed: OpenRouterModel[] = []
  for (const model of json.data ?? []) {
    const upstreamId = asOptionalString(model.id)
    if (!upstreamId) continue

    // Upstream ids are vendor-namespaced WITH slashes (alibaba/qwen-3-14b,
    // openai/gpt-6-astra). Prefix UNIFORMLY — every internal id gains
    // exactly one `vercel/` routing prefix, INCLUDING an upstream id that
    // already starts with `vercel/`. This is load-bearing: the wire id must
    // equal the upstream catalog id, and idTransform: 'strip' removes
    // exactly one segment — so `vercel/vercel/router` → wire `vercel/router`
    // and `vercel/alibaba/qwen-3-14b` → wire `alibaba/qwen-3-14b`
    // (upstream). The orcarouter precedent: a passthrough branch would send
    // a bare, un-routable remainder for already-prefixed ids.
    const id = `vercel/${upstreamId}`
    // The gateway publishes `context_window`/`max_tokens` — NOT openrouter's
    // `context_length`/`max_completion_tokens` — and a numeric `created`,
    // while OpenRouterModel.created is a string (types.ts). Map explicitly;
    // copying an openrouter-shaped parser would silently drop windows.
    const created = asOptionalNumber(model.created)
    parsed.push({
      id,
      name: asOptionalString(model.name) ?? upstreamId,
      description: asOptionalString(model.description),
      contextLength: asOptionalNumber(model.context_window),
      maxCompletionTokens: asOptionalNumber(model.max_tokens),
      created: created === undefined ? undefined : String(created),
      provider: 'vercel',
    })
  }
  parsed.sort((a, b) => a.id.localeCompare(b.id))
  return parsed
}

const fetcher = createLiveCatalogFetcher<VercelModelsResponse>({
  url: VERCEL_MODELS_URL,
  logLabel: 'Vercel AI Gateway',
  parse: parseVercelCatalog,
})

export const fetchVercelModels = fetcher.fetchModels
export const getCachedVercelModels = fetcher.getCachedModels
export const hasVercelCatalog = fetcher.hasCatalog
export const __resetVercelCacheForTest = fetcher.resetForTest

/** Test-only parser seam for catalog contract tests without network access. */
export function parseVercelModelsForTest(
  json: VercelModelsResponse,
): OpenRouterModel[] {
  return parseVercelCatalog(json)
}

/**
 * Live B.AI model catalog (FID-2026-0911-004).
 *
 * B.AI exposes an AUTHENTICATED OpenAI-compatible `/v1/models` endpoint
 * (contract: https://docs.b.ai/llmservice/api/ — unified API serving
 * OpenAI Chat Completions, OpenAI Responses, and Anthropic Messages
 * behind one `BAI_API_KEY`; keyless /v1/models probed → 401). The key is
 * supplied via the Nous/apinex-style resolver; the shared live-catalog
 * fetcher supplies bounded timeout, cache, in-flight deduplication,
 * stale-cache fallback, and redacted failure handling.
 */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { createLiveCatalogFetcher } from './live-catalog'

import type { OpenRouterModel } from './types'

const BAI_MODELS_URL = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'bai')
if (!BAI_MODELS_URL) {
  throw new Error(
    'bai catalog must be configured as live in the provider registry',
  )
}

type BaiModelsResponse = {
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

function parseBaiCatalog(json: BaiModelsResponse): OpenRouterModel[] {
  const parsed: OpenRouterModel[] = []
  for (const model of json.data ?? []) {
    const upstreamId = asOptionalString(model.id)
    if (!upstreamId) continue

    // PREFIX UNIFORMLY (the FID-2026-0911-002 lesson): every internal id
    // gains exactly one `bai/` routing prefix, INCLUDING ids that already
    // start with `bai/`. The documented upstream id shape is under-
    // specified ("your-model-id"), so bare ids, vendor-namespaced ids
    // (anthropic/claude-opus-5), and provider-native prefixed ids must
    // all round-trip: idTransform: 'strip' removes exactly one segment,
    // so the wire id always equals the upstream catalog id.
    const id = `bai/${upstreamId}`
    parsed.push({
      id,
      name: asOptionalString(model.name) ?? upstreamId,
      description: asOptionalString(model.description),
      contextLength: asOptionalNumber(model.context_length),
      maxCompletionTokens: asOptionalNumber(model.max_completion_tokens),
      created: asOptionalString(model.created),
      provider: 'bai',
    })
  }
  parsed.sort((a, b) => a.id.localeCompare(b.id))
  return parsed
}

const fetcher = createLiveCatalogFetcher<BaiModelsResponse>({
  url: BAI_MODELS_URL,
  logLabel: 'B.AI',
  parse: parseBaiCatalog,
  resolveKey: () => process.env.BAI_API_KEY,
})

export const fetchBaiModels = fetcher.fetchModels
export const getCachedBaiModels = fetcher.getCachedModels
export const hasBaiCatalog = fetcher.hasCatalog
export const __resetBaiCacheForTest = fetcher.resetForTest

/** Test-only parser seam for catalog contract tests without network access. */
export function parseBaiModelsForTest(
  json: BaiModelsResponse,
): OpenRouterModel[] {
  return parseBaiCatalog(json)
}

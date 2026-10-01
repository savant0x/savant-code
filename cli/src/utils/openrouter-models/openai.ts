/**
 * Live OpenAI platform model catalog (FID-2026-1001-001).
 *
 * The OpenAI platform exposes an authenticated `/v1/models` endpoint
 * (contract: https://platform.openai.com/docs/api-reference/models/list).
 * The shared live-catalog fetcher supplies bounded timeout, cache,
 * in-flight deduplication, stale-cache fallback, and redacted failure
 * handling. The account-visible roster needs the key; the endpoint also
 * serves keyless, matching the seam's optional-key contract.
 */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { createLiveCatalogFetcher } from './live-catalog'
import { asOptionalNumber, asOptionalString } from './wire-guards'

import type { OpenRouterModel } from './types'

const OPENAI_MODELS_URL = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'openai')
if (!OPENAI_MODELS_URL) {
  throw new Error(
    'openai catalog must be configured as live in the provider registry',
  )
}

type OpenAiModelsResponse = {
  data?: Array<{
    id?: unknown
    name?: unknown
    description?: unknown
    context_length?: unknown
    max_completion_tokens?: unknown
    created?: unknown
  }>
}

function parseOpenAiCatalog(json: OpenAiModelsResponse): OpenRouterModel[] {
  const parsed: OpenRouterModel[] = []
  for (const model of json.data ?? []) {
    const upstreamId = asOptionalString(model.id)
    if (!upstreamId) continue

    // Upstream ids are bare platform slugs (gpt-5.3-codex); the internal
    // `openai/` routing prefix is added exactly once here and stripped
    // before the request (idTransform: 'strip').
    const id = upstreamId.startsWith('openai/')
      ? upstreamId
      : `openai/${upstreamId}`
    parsed.push({
      id,
      name: asOptionalString(model.name) ?? upstreamId,
      description: asOptionalString(model.description),
      contextLength: asOptionalNumber(model.context_length),
      maxCompletionTokens: asOptionalNumber(model.max_completion_tokens),
      created: asOptionalString(model.created),
      provider: 'openai',
    })
  }
  parsed.sort((a, b) => a.id.localeCompare(b.id))
  return parsed
}

const fetcher = createLiveCatalogFetcher<OpenAiModelsResponse>({
  url: OPENAI_MODELS_URL,
  logLabel: 'OpenAI',
  parse: parseOpenAiCatalog,
  resolveKey: () => process.env.OPENAI_API_KEY,
})

export const fetchOpenAiModels = fetcher.fetchModels
export const getCachedOpenAiModels = fetcher.getCachedModels
export const hasOpenAiCatalog = fetcher.hasCatalog
export const __resetOpenAiCacheForTest = fetcher.resetForTest

/** Test-only parser seam for catalog contract tests without network access. */
export function parseOpenAiModelsForTest(
  json: OpenAiModelsResponse,
): OpenRouterModel[] {
  return parseOpenAiCatalog(json)
}

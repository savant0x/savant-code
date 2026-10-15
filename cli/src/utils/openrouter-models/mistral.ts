/**
 * Live Mistral AI model catalog (FID-2026-1009-005).
 *
 * api.mistral.ai exposes an AUTHENTICATED OpenAI-compatible `/v1/models`
 * (probed 2026-10-09: HTTP 200 / 46 rows with a key, 401 keyless), so the
 * fetcher wires `resolveKey` (the Nous / cleanapis / codecraft pattern) —
 * a keyless url-only entry would silently never populate.
 *
 * The row shape is NOT OpenRouter's: windows publish under
 * `max_context_length` (not `context_length`), `created` is a numeric unix
 * epoch, `capabilities` is an object of booleans, and there are no pricing
 * fields anywhere. Reusing the shared `parseChatCatalog` would extract
 * ZERO windows (the Vercel mis-parse class — measured, not assumed), so
 * this module carries a dedicated parser following the `parseVercelCatalog`
 * precedent. Prices stay absent: the vendor publishes none, and a
 * fabricated price is worse than an unknown one.
 */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { resolveProviderApiKey } from '../provider-credentials'
import {
  catalogCreated,
  catalogLimit,
  catalogObject,
  catalogRows,
} from './catalog-values'
import { createLiveCatalogFetcher } from './live-catalog'
import { asOptionalString } from './wire-guards'

import type { OpenRouterModel } from './types'

const url = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'mistral')
if (!url)
  throw new Error(
    'mistral catalog must be configured as live in the provider registry',
  )

function parseMistralCatalog(json: unknown): OpenRouterModel[] {
  const parsed: OpenRouterModel[] = []
  for (const value of catalogRows(json)) {
    const row = catalogObject(value)
    const upstreamId = asOptionalString(row.id)
    if (!upstreamId) continue
    // Upstream ids are bare (`codestral-2508`); prefix uniformly so the
    // internal id carries exactly one `mistral/` routing segment and
    // idTransform 'strip' removes exactly that segment on the wire.
    const created = catalogCreated(row.created)
    parsed.push({
      id: `mistral/${upstreamId}`,
      name: asOptionalString(row.name) ?? upstreamId,
      description: asOptionalString(row.description),
      // The window field is `max_context_length` — the shared parser reads
      // `context_length` ?? `context_window` and would extract zero.
      contextLength: catalogLimit(row.max_context_length),
      created,
      provider: 'mistral',
    })
  }
  parsed.sort((a, b) => a.id.localeCompare(b.id))
  return parsed
}

const fetcher = createLiveCatalogFetcher<unknown>({
  url,
  logLabel: 'Mistral AI',
  parse: parseMistralCatalog,
  resolveKey: () => resolveProviderApiKey('mistral'),
})

export const fetchMistralModels = fetcher.fetchModels
export const getCachedMistralModels = fetcher.getCachedModels
export const hasMistralCatalog = fetcher.hasCatalog
export const __resetMistralCacheForTest = fetcher.resetForTest

/** Test-only parser seam for catalog contract tests without network access. */
export function parseMistralModelsForTest(json: unknown): OpenRouterModel[] {
  return parseMistralCatalog(json)
}

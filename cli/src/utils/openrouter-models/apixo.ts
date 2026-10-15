/**
 * Live Apixo model catalog (FID-2026-1013-003).
 *
 * api.apixoai.online exposes a PUBLIC [OI]-compatible `/v1/models` (probed
 * 2026-10-13: HTTP 200 / 35 rows keyless, and the keyless body is byte-identical
 * to the authenticated one), so the fetcher takes NO `resolveKey` — the
 * Vercel/OrcaRouter pattern. A resolver here would be the drift the runbook
 * names: an absent key must not turn a public catalog into an empty one.
 *
 * The row shape is NOT OpenRouter's: windows publish under `context_window`
 * with `max_output_tokens` (not `context_length`/`max_completion_tokens`), the
 * label is `display_name`, and `created` is a numeric epoch beside an ISO
 * `created_at`. Reusing the shared `parseChatCatalog` would extract ZERO
 * windows (the Vercel mis-parse class — measured, not assumed), so this module
 * carries a dedicated parser following the `parseVercelCatalog` precedent.
 *
 * Seven rows render `display_name` as "the model <version>" while their `id`
 * keeps the vendor's real slug. The label is cosmetic: routing reads `id`, and
 * only `id` is prefixed.
 */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import {
  catalogCreated,
  catalogLimit,
  catalogObject,
  catalogRows,
} from './catalog-values'
import { createLiveCatalogFetcher } from './live-catalog'
import { asOptionalString } from './wire-guards'

import type { OpenRouterModel } from './types'

const url = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'apixo')
if (!url)
  throw new Error(
    'apixo catalog must be configured as live in the provider registry',
  )

function parseApixoCatalog(json: unknown): OpenRouterModel[] {
  const parsed: OpenRouterModel[] = []
  for (const value of catalogRows(json)) {
    const row = catalogObject(value)
    const upstreamId = asOptionalString(row.id)
    if (!upstreamId) continue
    // Upstream ids are bare (`deepseek-v4.1-flash`); prefix uniformly so the
    // internal id carries exactly one `apixo/` routing segment and
    // idTransform 'strip' removes exactly that segment on the wire.
    parsed.push({
      id: `apixo/${upstreamId}`,
      name: asOptionalString(row.display_name) ?? upstreamId,
      // The window fields are `context_window`/`max_output_tokens` — the
      // shared parser reads `context_length`/`max_completion_tokens` and
      // would extract zero.
      contextLength: catalogLimit(row.context_window),
      maxCompletionTokens: catalogLimit(row.max_output_tokens),
      // The vendor publishes both an ISO `created_at` and a numeric `created`;
      // catalogCreated passes a string through and normalizes an epoch.
      created: catalogCreated(row.created_at ?? row.created),
      provider: 'apixo',
    })
  }
  parsed.sort((a, b) => a.id.localeCompare(b.id))
  return parsed
}

const fetcher = createLiveCatalogFetcher<unknown>({
  url,
  logLabel: 'Apixo',
  parse: parseApixoCatalog,
})

export const fetchApixoModels = fetcher.fetchModels
export const getCachedApixoModels = fetcher.getCachedModels
export const hasApixoCatalog = fetcher.hasCatalog
export const __resetApixoCacheForTest = fetcher.resetForTest

/** Test-only parser seam for catalog contract tests without network access. */
export function parseApixoModelsForTest(json: unknown): OpenRouterModel[] {
  return parseApixoCatalog(json)
}

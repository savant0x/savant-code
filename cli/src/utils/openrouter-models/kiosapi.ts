/**
 * Live KiosAPI model catalog.
 *
 * FID-2026-1008-001: the source is the vendor's **public** pricing feed
 * `GET https://kiosapi.com/api/pricing` (unauthenticated; HTTP 200 measured
 * 2026-10-08, 80 rows, `pricing_version` content hash) — the same JSON the
 * Models & Pricing page renders. The previous source, the key-scoped
 * `GET /v1/models`, is documented by the vendor as "list all models available
 * for your API key" (different token groups see different models), so a
 * `Free`-group key inherited the Free group's 36-row view of the square and
 * every flagship on the site — `gpt-5.6-sol`, `claude-opus-5-5`,
 * `gemini-3.8-flash`, `grok-4.7` — was absent from the picker ("old/outdated",
 * operator report 2026-10-08). Listing must not depend on which token group
 * the stored key belongs to, so no key is resolved for this request.
 *
 * **Wire shape, measured 2026-10-08** (`data[]` rows):
 * `{ model_name, description, icon, tags, vendor_id, quota_type, model_ratio,
 * model_price, owner_by, completion_ratio, enable_groups[],
 * supported_endpoint_types[], billing_mode, billing_expr? }` — pricing is in
 * vendor billing terms (ratios / tiered expressions), not per-token dollars,
 * so no price fields are mapped. There are no window fields (same as the old
 * `/v1/models` — FID-2026-1003-008), so context lookups keep the checked-in
 * fallback table (200k default for no-row ids). The internal `kiosapi/`
 * routing prefix applies as before (`idTransform: 'strip'` at chat time).
 * Synchronous parse; the shared fetcher supplies cache, timeout and degrade.
 */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { createLiveCatalogFetcher } from './live-catalog'
import { asOptionalString } from './wire-guards'

import type { OpenRouterModel } from './types'

const KIOSAPI_MODELS_URL = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'kiosapi')
if (!KIOSAPI_MODELS_URL) {
  throw new Error(
    'kiosapi catalog must be configured as live in the provider registry',
  )
}

type KiosapiPricingResponse = {
  data?: Array<{
    model_name?: unknown
    description?: unknown
  }>
}

function parseKiosapiCatalog(json: KiosapiPricingResponse): OpenRouterModel[] {
  const parsed: OpenRouterModel[] = []
  for (const model of json.data ?? []) {
    const upstreamId = asOptionalString(model.model_name)
    if (!upstreamId) continue

    parsed.push({
      id: upstreamId.startsWith('kiosapi/')
        ? upstreamId
        : `kiosapi/${upstreamId}`,
      // The pricing feed carries no display-name field; the vendor's own
      // page titles rows from `model_name` too, so no naming layer here.
      name: upstreamId,
      description: asOptionalString(model.description),
      provider: 'kiosapi',
    })
  }
  parsed.sort((a, b) => a.id.localeCompare(b.id))
  return parsed
}

// Public feed: deliberately NO resolveKey (FID-2026-1008-001) — a Bearer
// header would re-couple listing to the stored key's token group.
const fetcher = createLiveCatalogFetcher<KiosapiPricingResponse>({
  url: KIOSAPI_MODELS_URL,
  logLabel: 'KiosAPI',
  parse: parseKiosapiCatalog,
})

export const fetchKiosapiModels = fetcher.fetchModels
export const getCachedKiosapiModels = fetcher.getCachedModels
export const hasKiosapiCatalog = fetcher.hasCatalog
export const __resetKiosapiCacheForTest = fetcher.resetForTest

/** Test-only parser seam for catalog contract tests without network access. */
export function parseKiosapiModelsForTest(
  json: KiosapiPricingResponse,
): OpenRouterModel[] {
  return parseKiosapiCatalog(json)
}

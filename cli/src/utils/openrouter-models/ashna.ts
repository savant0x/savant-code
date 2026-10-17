/**
 * Live Ashna model catalog (FID-2026-1016-018).
 *
 * api.ashna.ai is a KEYED OpenAI-compatible gateway (401 keyless, probed
 * 2026-10-16): GET /v1/api/models is an OpenAI-shaped list with bare-slug
 * ids and no window or name fields. The vendor's own retrieval/image
 * products (`voyage-*`, `rerank-*`, `ashna-diffusion-*`) ride the same
 * list; they are excluded locally because their ids name no modality for
 * the shared harness filter to catch.
 */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { resolveProviderApiKey } from '../provider-credentials'
import { isCodingHarnessModel } from './catalog-filter'
import { catalogCreated, catalogObject, catalogRows } from './catalog-values'
import { createLiveCatalogFetcher } from './live-catalog'
import { asOptionalString } from './wire-guards'

import type { OpenRouterModel } from './types'

const url = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'ashna')
if (!url)
  throw new Error(
    'ashna catalog must be configured as live in the provider registry',
  )

/** Vendor-own retrieval/image families that share the chat model list. */
const NON_CHAT_ID_PREFIX = /^(voyage-|rerank-|ashna-diffusion-)/

function parseAshnaCatalog(json: unknown): OpenRouterModel[] {
  const parsed: OpenRouterModel[] = []
  for (const value of catalogRows(json)) {
    const row = catalogObject(value)
    const upstreamId = asOptionalString(row.id)
    if (!upstreamId || NON_CHAT_ID_PREFIX.test(upstreamId)) continue
    // Rows carry no display name: the upstream id is the honest label.
    const name = asOptionalString(row.name) ?? upstreamId
    // Drift defense: future media rows may name their modality directly.
    if (!isCodingHarnessModel(upstreamId, name)) continue
    parsed.push({
      id: `ashna/${upstreamId}`,
      name,
      // Upstream ids are bare (`gpt-5.5`); prefix uniformly so the internal
      // id carries exactly one `ashna/` routing segment and idTransform
      // 'strip' removes exactly that segment on the wire.
      // `created` is a numeric epoch (measured); catalogCreated passes a
      // string through and normalizes an epoch, so both drifts survive.
      created: catalogCreated(row.created),
      provider: 'ashna',
    })
  }
  parsed.sort((a, b) => a.id.localeCompare(b.id))
  return parsed
}

const fetcher = createLiveCatalogFetcher<unknown>({
  url,
  logLabel: 'Ashna',
  parse: parseAshnaCatalog,
  resolveKey: () => resolveProviderApiKey('ashna'),
})

export const fetchAshnaModels = fetcher.fetchModels
export const getCachedAshnaModels = fetcher.getCachedModels
export const hasAshnaCatalog = fetcher.hasCatalog
export const __resetAshnaCacheForTest = fetcher.resetForTest

/** Test-only parser seam for catalog contract tests without network access. */
export function parseAshnaModelsForTest(json: unknown): OpenRouterModel[] {
  return parseAshnaCatalog(json)
}

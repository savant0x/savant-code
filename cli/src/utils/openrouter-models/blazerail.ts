/** Public BlazeRail catalog; inference requires a key (FID-2026-1017-013). */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { isCodingHarnessModel } from './catalog-filter'
import { catalogObject, catalogRows } from './catalog-values'
import { parseChatCatalog } from './chat-catalog'
import { createLiveCatalogFetcher } from './live-catalog'
import { asOptionalString } from './wire-guards'

import type { OpenRouterModel } from './types'

const url = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'blazerail')
if (!url) throw new Error('blazerail live catalog URL missing from registry')

// Measured public roster: image, video and audio share the text list. Category
// metadata catches media names (e.g. flux/sora) that do not name their modality.
const NON_CHAT_CATEGORIES = new Set(['image', 'video', 'audio'])

export function parseBlazerailModels(json: unknown): OpenRouterModel[] {
  const data = catalogRows(json).filter((value) => {
    const row = catalogObject(value)
    const id = asOptionalString(row.id)
    const category = asOptionalString(row.category)?.toLowerCase()
    return (
      id !== undefined &&
      !NON_CHAT_CATEGORIES.has(category ?? '') &&
      isCodingHarnessModel(id, asOptionalString(row.name))
    )
  })
  // Measured 2026-10-17: context_length, decimal per-token pricing,
  // top_provider limits and numeric created match the shared chat schema.
  // Prefixing preserves vendor namespaces and :free/:nitro/:floor verbatim.
  return parseChatCatalog('blazerail', { data })
}

const fetcher = createLiveCatalogFetcher({
  url,
  logLabel: 'BlazeRail',
  parse: parseBlazerailModels,
})

export const fetchBlazerailModels = fetcher.fetchModels
export const getCachedBlazerailModels = fetcher.getCachedModels
export const hasBlazerailCatalog = fetcher.hasCatalog
export const __resetBlazerailCacheForTest = fetcher.resetForTest

/** Authenticated live CodeCraft API catalog (FID-2026-1003-001). */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { parseChatCatalog } from './chat-catalog'
import { createLiveCatalogFetcher } from './live-catalog'

const url = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'codecraft')
if (!url)
  throw new Error(
    'codecraft catalog must be configured as live in the provider registry',
  )

const fetcher = createLiveCatalogFetcher({
  url,
  logLabel: 'CodeCraft API',
  parse: (json) => parseChatCatalog('codecraft', json),
  resolveKey: () => process.env.CODECRAFT_API_KEY,
})

export const fetchCodecraftModels = fetcher.fetchModels
export const getCachedCodecraftModels = fetcher.getCachedModels
export const hasCodecraftCatalog = fetcher.hasCatalog
export const __resetCodecraftCacheForTest = fetcher.resetForTest

export const parseCodecraftModelsForTest = (json: unknown) =>
  parseChatCatalog('codecraft', json)

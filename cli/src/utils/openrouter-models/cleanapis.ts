/** Authenticated CleanAPIs catalog; shares its measured schema with CodeCraft. */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { resolveProviderApiKey } from '../provider-credentials'
import { parseChatCatalog } from './chat-catalog'
import { createLiveCatalogFetcher } from './live-catalog'

const url = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'cleanapis')
if (!url)
  throw new Error(
    'cleanapis catalog must be configured as live in the provider registry',
  )

const fetcher = createLiveCatalogFetcher({
  url,
  logLabel: 'Clean APIs',
  parse: (json) => parseChatCatalog('cleanapis', json),
  resolveKey: () => resolveProviderApiKey('cleanapis'),
})

export const fetchCleanApisModels = fetcher.fetchModels
export const getCachedCleanApisModels = fetcher.getCachedModels
export const hasCleanApisCatalog = fetcher.hasCatalog
export const __resetCleanApisCacheForTest = fetcher.resetForTest

export const parseCleanApisModelsForTest = (json: unknown) =>
  parseChatCatalog('cleanapis', json)

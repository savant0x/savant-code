import { jsonToolResult } from '@savant-code/common/util/messages'
import { catalogSearch } from '@savant-code/connectors/runtime'

import { launchBundleProvider } from './connector-bundle'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type { BundleProvider } from './connector-bundle'
import type { SavantCodeToolCall } from '@savant-code/common/tools/list'

/**
 * `connector_search` (FID-2026-0930-003): browse the in-repo catalog —
 * providers with no filter, matching endpoints with any filter. Reads the
 * checked-in bundle; no network, no engine.
 */
export function makeConnectorSearchHandler(
  bundleProvider: BundleProvider,
): SavantCodeToolHandlerFunction<'connector_search'> {
  return async ({ toolCall }) => {
    const { provider, category, query } = (
      toolCall as SavantCodeToolCall<'connector_search'>
    ).input
    try {
      const bundle = await bundleProvider()
      const result = catalogSearch(bundle, { provider, category, query })
      return { output: jsonToolResult(result) }
    } catch (error) {
      return {
        output: jsonToolResult({
          errorMessage:
            error instanceof Error ? error.message : String(error),
        }),
      }
    }
  }
}

export const handleConnectorSearch = makeConnectorSearchHandler(
  launchBundleProvider,
)

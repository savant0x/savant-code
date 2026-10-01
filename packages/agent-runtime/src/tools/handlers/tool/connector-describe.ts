import { jsonToolResult } from '@savant-code/common/util/messages'
import { describeEndpoint } from '@savant-code/connectors/runtime'

import { launchBundleProvider } from './connector-bundle'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type { BundleProvider } from './connector-bundle'

/**
 * `connector_describe` (FID-2026-0930-003): return one endpoint's compiled
 * doc — the doc IS the contract (catalog invariant): request shape, input
 * schema (what `connector_invoke`'s `input` expects), credential fields,
 * usage model. Reads the checked-in bundle; no network, no engine.
 */
export function makeConnectorDescribeHandler(
  bundleProvider: BundleProvider,
): SavantCodeToolHandlerFunction<'connector_describe'> {
  return async ({ toolCall }) => {
    const { provider, endpoint } = toolCall.input
    try {
      const bundle = await bundleProvider()
      const doc = describeEndpoint(bundle, provider, endpoint)
      return { output: jsonToolResult({ endpoint: doc }) }
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

export const handleConnectorDescribe = makeConnectorDescribeHandler(
  launchBundleProvider,
)

import { jsonToolResult } from '@savant-code/common/util/messages'
import { providerCredentials } from '@savant-code/connectors/runtime'

import { launchBundleProvider } from './connector-bundle'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type { BundleProvider } from './connector-bundle'

/**
 * `connector_credentials` (FID-2026-0930-003): report which env vars a
 * provider needs and whether they are SET — names + presence only. A
 * credential VALUE never crosses this boundary (Law 12); values are read
 * solely inside the engine's transport at egress.
 *
 * Credential shapes live on ENDPOINT docs (the provider doc deliberately
 * carries no copy — it goes stale the moment an endpoint overrides), so
 * the report aggregates the distinct field sets across the provider's
 * endpoints and marks readiness per field.
 */
export function makeConnectorCredentialsHandler(
  bundleProvider: BundleProvider,
): SavantCodeToolHandlerFunction<'connector_credentials'> {
  return async ({ toolCall }) => {
    const { provider } = toolCall.input
    try {
      const bundle = await bundleProvider()
      if (bundle.providers[provider] === undefined) {
        return {
          output: jsonToolResult({
            errorMessage:
              `provider not in bundle: ${provider} (known: ` +
              `${Object.keys(bundle.providers).sort().join(', ')})`,
          }),
        }
      }
      // distinct credential field sets across this provider's endpoints
      const fieldSets = new Set(
        Object.values(bundle.endpoints)
          .filter((doc) => doc.provider === provider)
          .map((doc) =>
            providerCredentials(provider, doc.auth.credentials)
              .credentials.map((c) => c.field)
              .sort()
              .join(','),
          ),
      )
      const reports = [...fieldSets].sort().map((fields) => {
        const shape = Object.fromEntries(
          fields.split(',').map((field) => [field, { type: 'string' }]),
        )
        return providerCredentials(provider, {
          type: 'object',
          properties: shape,
          required: fields.split(','),
        }).credentials
      })
      const ready =
        reports.length > 0 &&
        reports.every((set) => set.every((c) => c.present))
      return {
        output: jsonToolResult({
          provider,
          credentials: reports.flat(),
          ready,
        }),
      }
    } catch (error) {
      return {
        output: jsonToolResult({
          errorMessage: error instanceof Error ? error.message : String(error),
        }),
      }
    }
  }
}

export const handleConnectorCredentials =
  makeConnectorCredentialsHandler(launchBundleProvider)

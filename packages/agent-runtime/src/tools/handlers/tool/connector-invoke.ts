import { jsonToolResult } from '@savant-code/common/util/messages'
import { executeEndpoint } from '@savant-code/connectors/runtime'

import { launchBundleProvider } from './connector-bundle'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type { BundleProvider } from './connector-bundle'
import type { RecordedFixtureSource } from '@savant-code/connectors/runtime'

/**
 * Replay fixture loader for replay-mode invokes. The record/replay harness
 * is a TEST surface (`@savant-code/connectors/testing`), which the runtime
 * must not import (it drags the compiler); the runtime's structural replay
 * consumes plain recorded chains, so production hosts implementing replay
 * register a loader here. None exists in the CLI today — replay-mode
 * invokes through the tool surface answer honestly until a host needs it
 * (the FID's mode contract: replay is the test/integration path).
 */
const replayFixtureLoader: ((path: string) => Promise<unknown>) | undefined =
  undefined

/**
 * `connector_invoke` (FID-2026-0930-003): execute one catalog endpoint.
 * Live mode egresses through the engine's transport (credentials resolved
 * from env INSIDE the port, applied at egress, never surfaced); the
 * handler does no fetch of its own. Network/prompt per the safety
 * registry — the pre-dispatch gate chain prompts before we run.
 */
export function makeConnectorInvokeHandler(
  bundleProvider: BundleProvider,
): SavantCodeToolHandlerFunction<'connector_invoke'> {
  return async ({ toolCall }) => {
    const { provider, endpoint, input, mode } = toolCall.input
    try {
      const bundle = await bundleProvider()
      let fixture: RecordedFixtureSource | undefined
      if (mode === 'replay') {
        if (replayFixtureLoader === undefined) {
          return {
            output: jsonToolResult({
              errorMessage:
                'connector_invoke replay mode is not available in this ' +
                'runtime: no fixture source is registered. Use live mode, ' +
                'or run the endpoint through the connectors test harness.',
            }),
          }
        }
        fixture = {
          kind: 'fixture',
          load: replayFixtureLoader,
          path: `${provider}/${endpoint}.json`,
        }
      }
      const result = await executeEndpoint({
        bundle,
        provider,
        endpoint,
        input,
        ...(mode !== undefined ? { mode } : {}),
        ...(fixture !== undefined ? { fixture } : {}),
      })
      return {
        output: jsonToolResult({
          httpStatus: result.httpStatus,
          output: result.output,
          usage: result.usage,
          isProviderError: result.isProviderError,
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

export const handleConnectorInvoke =
  makeConnectorInvokeHandler(launchBundleProvider)

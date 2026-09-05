import type { ExecuteToolCallParams } from './types'
import type { ToolName } from '@savant-code/common/tools/constants'
import type {
  ClientToolCall,
  ClientToolName,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'

/**
 * Client-tool bridge (extracted verbatim from `tool-executor/native.ts` —
 * FID-2026-0905-001, per the FID's Q10 facade-ceiling contingency).
 *
 * FID-029: `as SavantCodeToolOutput<...>` casts are accepted pre-existing
 * tech debt (tracking FID-2026-0719-029 archived; rationale inlined). The
 * runtime SDK returns the raw client-tool result shape; bridging to
 * SavantCodeToolOutput<...> at the conditional closure slot requires this
 * cast. On abort, we return a graceful JSON-tool-result matching composio's
 * missing-runtime fallback pattern (rather than `[]`, which propagated a
 * wrong-shape never[] downstream). The cast uses
 * `T extends ClientToolName ? T : never` to align with the slot's exact
 * conditional type so it satisfies ECHO distribution cleanly.
 */
export function createClientToolBridge<T extends ToolName>(deps: {
  signal: AbortSignal
  userInputId: string
  requestToolCall: ExecuteToolCallParams<T>['requestToolCall']
}): (
  clientToolCall: ClientToolCall<T extends ClientToolName ? T : never>,
) => Promise<SavantCodeToolOutput<T extends ClientToolName ? T : never>> {
  const { signal, userInputId, requestToolCall } = deps
  return async (
    clientToolCall: ClientToolCall<T extends ClientToolName ? T : never>,
  ) => {
    if (signal.aborted) {
      return [
        {
          type: 'json',
          value: {
            errorMessage: `Tool call aborted: ${clientToolCall.toolName}`,
          },
        },
      ] as SavantCodeToolOutput<T extends ClientToolName ? T : never>
    }

    const clientToolResult = await requestToolCall({
      userInputId,
      toolName: clientToolCall.toolName,
      input: clientToolCall.input,
    })
    return clientToolResult.output as SavantCodeToolOutput<
      T extends ClientToolName ? T : never
    >
  }
}

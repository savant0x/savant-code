import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type { ComposioMetaToolName } from '@savant-code/common/constants/composio'
import type {
  ClientToolCall,
  ClientToolName,
} from '@savant-code/common/tools/list'

function makeComposioHandler<
  T extends ComposioMetaToolName,
>(): SavantCodeToolHandlerFunction<T> {
  return async ({ toolCall, requestClientToolCall }) => {
    if (!requestClientToolCall) {
      return {
        output: [
          {
            type: 'json',
            value: {
              errorMessage: 'Composio tools are not available in this runtime.',
            },
          },
        ],
      }
    }

    // FID-029: `as ClientToolCall<T extends ClientToolName ? T : never>`
    // is accepted pre-existing tech debt. See
    // dev/fids/FID-2026-0719-029-as-cast-tech-debt.md. The conditional
    // form is required to align exactly with the handler-function-type
    // slot signature `ClientToolCall<T extends ClientToolName ? T : never>`;
    // TypeScript treats `ClientToolCall<T>` and
    // `ClientToolCall<T extends ClientToolName ? T : never>` as distinct
    // nominal identities even when they resolve to the same concrete type.
    const clientToolCall = {
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      input: toolCall.input,
      providerOptions: toolCall.providerOptions,
    } as ClientToolCall<T extends ClientToolName ? T : never>
    return {
      output: await requestClientToolCall(clientToolCall),
    }
  }
}

export const handleComposioManageConnections: SavantCodeToolHandlerFunction<'composio_manage_connections'> =
  makeComposioHandler<'composio_manage_connections'>()
export const handleComposioMultiExecute: SavantCodeToolHandlerFunction<'composio_multi_execute_tool'> =
  makeComposioHandler<'composio_multi_execute_tool'>()
export const handleComposioSearchTools: SavantCodeToolHandlerFunction<'composio_search_tools'> =
  makeComposioHandler<'composio_search_tools'>()
export const handleComposioGetToolSchemas: SavantCodeToolHandlerFunction<'composio_get_tool_schemas'> =
  makeComposioHandler<'composio_get_tool_schemas'>()

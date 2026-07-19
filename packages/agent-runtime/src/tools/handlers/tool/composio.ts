import type { ComposioMetaToolName } from '@savant-code/common/constants/composio'
import type { SavantCodeToolOutput } from '@savant-code/common/tools/list'
import type { SavantCodeToolHandlerFunction } from '../handler-function-type'

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

    return {
      output: (await (requestClientToolCall as any)(
        toolCall,
      )) as SavantCodeToolOutput<T>,
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

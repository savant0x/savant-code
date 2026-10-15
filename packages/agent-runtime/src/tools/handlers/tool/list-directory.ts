import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  ClientToolCall,
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'

type ToolName = 'list_directory'
export const handleListDirectory = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<ToolName>
  requestClientToolCall: (
    toolCall: ClientToolCall<ToolName>,
  ) => Promise<SavantCodeToolOutput<ToolName>>
}): Promise<{
  output: SavantCodeToolOutput<ToolName>
}> => {
  const { previousToolCallFinished, toolCall, requestClientToolCall } = params

  await previousToolCallFinished
  return { output: await requestClientToolCall(toolCall) }
}) satisfies SavantCodeToolHandlerFunction<ToolName>

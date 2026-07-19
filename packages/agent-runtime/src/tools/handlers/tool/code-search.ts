import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  ClientToolCall,
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'

export const handleCodeSearch = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'code_search'>
  requestClientToolCall: (
    toolCall: ClientToolCall<'code_search'>,
  ) => Promise<SavantCodeToolOutput<'code_search'>>
}): Promise<{
  output: SavantCodeToolOutput<'code_search'>
}> => {
  const { previousToolCallFinished, toolCall, requestClientToolCall } = params

  await previousToolCallFinished
  return { output: await requestClientToolCall(toolCall) }
}) satisfies SavantCodeToolHandlerFunction<'code_search'>

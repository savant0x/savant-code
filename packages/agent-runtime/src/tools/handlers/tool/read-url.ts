import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  ClientToolCall,
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'

export const handleReadUrl = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'read_url'>
  requestClientToolCall: (
    toolCall: ClientToolCall<'read_url'>,
  ) => Promise<SavantCodeToolOutput<'read_url'>>
}): Promise<{
  output: SavantCodeToolOutput<'read_url'>
}> => {
  const { previousToolCallFinished, toolCall, requestClientToolCall } = params

  await previousToolCallFinished
  return { output: await requestClientToolCall(toolCall) }
}) satisfies SavantCodeToolHandlerFunction<'read_url'>

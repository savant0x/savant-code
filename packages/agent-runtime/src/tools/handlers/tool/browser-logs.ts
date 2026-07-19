import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  ClientToolCall,
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'

export const handleBrowserLogs = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'browser_logs'>
  requestClientToolCall: (
    toolCall: ClientToolCall<'browser_logs'>,
  ) => Promise<SavantCodeToolOutput<'browser_logs'>>
}): Promise<{
  output: SavantCodeToolOutput<'browser_logs'>
}> => {
  const { previousToolCallFinished, toolCall, requestClientToolCall } = params

  await previousToolCallFinished
  return { output: await requestClientToolCall(toolCall) }
}) satisfies SavantCodeToolHandlerFunction<'browser_logs'>

import { jsonToolResult } from '@savant-code/common/util/messages'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'

type ToolName = 'write_todos'
export const handleWriteTodos = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<ToolName>
}): Promise<{ output: SavantCodeToolOutput<ToolName> }> => {
  const { previousToolCallFinished } = params

  await previousToolCallFinished

  return { output: jsonToolResult({ message: 'Todos written' }) }
}) satisfies SavantCodeToolHandlerFunction<ToolName>

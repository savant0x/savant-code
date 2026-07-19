import { assistantMessage, userMessage } from '@savant-code/common/util/messages'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { AgentState } from '@savant-code/common/types/session-state'

export const handleAddMessage = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'add_message'>

  agentState: AgentState
}): Promise<{
  output: SavantCodeToolOutput<'add_message'>
}> => {
  const {
    previousToolCallFinished,
    toolCall,

    agentState,
  } = params

  await previousToolCallFinished

  agentState.messageHistory.push(
    toolCall.input.role === 'user'
      ? userMessage(toolCall.input.content)
      : assistantMessage(toolCall.input.content),
  )

  return { output: [{ type: 'json', value: { message: 'Message added.' } }] }
}) satisfies SavantCodeToolHandlerFunction<'add_message'>

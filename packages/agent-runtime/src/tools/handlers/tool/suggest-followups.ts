import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'

export const handleSuggestFollowups = (async (params: {
  previousToolCallFinished: Promise<unknown>
  toolCall: SavantCodeToolCall<'suggest_followups'>
  logger: Logger
}): Promise<{ output: SavantCodeToolOutput<'suggest_followups'> }> => {
  const { previousToolCallFinished, toolCall } = params
  const { followups: _followups } = toolCall.input

  await previousToolCallFinished
  return { output: [{ type: 'json', value: { message: 'Followups suggested!' } }] }
}) satisfies SavantCodeToolHandlerFunction<'suggest_followups'>

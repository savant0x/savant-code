import { buildArray } from '@savant-code/common/util/array'
import { jsonToolResult } from '@savant-code/common/util/messages'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { Subgoal } from '@savant-code/common/types/session-state'

export const handleAddSubgoal = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'add_subgoal'>

  agentContext: Record<string, Subgoal>
}): Promise<{
  output: SavantCodeToolOutput<'add_subgoal'>
}> => {
  const { previousToolCallFinished, toolCall, agentContext } = params

  agentContext[toolCall.input.id] = {
    objective: toolCall.input.objective,
    status: toolCall.input.status,
    plan: toolCall.input.plan,
    logs: buildArray([toolCall.input.log]),
  }

  await previousToolCallFinished
  return { output: jsonToolResult({ message: 'Successfully added subgoal' }) }
}) satisfies SavantCodeToolHandlerFunction<'add_subgoal'>

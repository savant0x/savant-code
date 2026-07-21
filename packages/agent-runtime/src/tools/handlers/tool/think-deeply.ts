import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'

export const handleThinkDeeply = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'think_deeply'>
  logger: Logger
}): Promise<{ output: SavantCodeToolOutput<'think_deeply'> }> => {
  const { previousToolCallFinished, toolCall, logger } = params
  const { thought } = toolCall.input

  logger.debug(
    {
      thought,
    },
    'Thought deeply',
  )

  await previousToolCallFinished
  return { output: [{ type: 'json', value: { message: 'Thought logged.' } }] }
}) satisfies SavantCodeToolHandlerFunction<'think_deeply'>

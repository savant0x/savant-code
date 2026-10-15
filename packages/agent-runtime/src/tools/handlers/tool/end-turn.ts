import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'

export const handleEndTurn = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'end_turn'>
}): Promise<{ output: SavantCodeToolOutput<'end_turn'> }> => {
  const { previousToolCallFinished } = params

  await previousToolCallFinished
  return { output: [{ type: 'json', value: { message: 'Turn ended.' } }] }
}) satisfies SavantCodeToolHandlerFunction<'end_turn'>

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'

export const handleTaskCompleted = (async ({
  previousToolCallFinished,
}: {
  previousToolCallFinished: Promise<any>
  toolCall: SavantCodeToolCall<'task_completed'>
}): Promise<{ output: SavantCodeToolOutput<'task_completed'> }> => {
  await previousToolCallFinished
  return { output: [{ type: 'json', value: { message: 'Task completed.' } }] }
}) satisfies SavantCodeToolHandlerFunction<'task_completed'>

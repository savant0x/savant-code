import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'

export const handleRenderUI = (async ({
  previousToolCallFinished,
}: {
  previousToolCallFinished: Promise<unknown>
  toolCall: SavantCodeToolCall<'render_ui'>
}): Promise<{ output: SavantCodeToolOutput<'render_ui'> }> => {
  await previousToolCallFinished
  return { output: [{ type: 'json', value: { message: 'UI rendered.' } }] }
}) satisfies SavantCodeToolHandlerFunction<'render_ui'>

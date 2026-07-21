import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'

export const handleSetScaffoldComplete = (async ({
  previousToolCallFinished,
  toolCall,
}: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'set_scaffold_complete'>
}): Promise<{ output: SavantCodeToolOutput<'set_scaffold_complete'> }> => {
  await previousToolCallFinished

  const summary =
    typeof toolCall.input.summary === 'string' ? toolCall.input.summary : ''

  return {
    output: [
      {
        type: 'json',
        value: {
          message: summary
            ? `Scaffold complete: ${summary}`
            : 'Scaffold complete.',
          scaffoldComplete: true,
        },
      },
    ],
  }
}) satisfies SavantCodeToolHandlerFunction<'set_scaffold_complete'>

import { getThoughtSession } from '../../thought-session-store'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'

export const handleSequentialThinking = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'sequentialthinking'>
  logger: Logger
  runId: string
}): Promise<{ output: SavantCodeToolOutput<'sequentialthinking'> }> => {
  const { toolCall, logger, runId } = params
  const {
    thought,
    thoughtNumber,
    totalThoughts,
    nextThoughtNeeded,
    isRevision,
    revisesThought,
    branchFromThought,
    branchId,
    needsMoreThoughts,
  } = toolCall.input

  logger.debug(
    { thoughtNumber, totalThoughts, nextThoughtNeeded },
    'Sequential thought',
  )

  // FID-2026-0801-012: route every accepted call through the per-run session.
  // The runtime convergence gate reads this session's snapshot after the final
  // tool result to build the non-null FinalArtifact.
  const session = getThoughtSession(runId)
  const result = session.processThought({
    thought,
    thoughtNumber,
    totalThoughts,
    nextThoughtNeeded,
    isRevision,
    revisesThought,
    branchFromThought,
    branchId,
    needsMoreThoughts,
  })

  return {
    output: [{ type: 'json', value: { message: JSON.stringify(result) } }],
  }
}) satisfies SavantCodeToolHandlerFunction<'sequentialthinking'>

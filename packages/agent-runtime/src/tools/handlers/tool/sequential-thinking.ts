import { SequentialThinkingServer } from '@savant-code/common/tools/sequential-thinking'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'

const servers = new Map<string, SequentialThinkingServer>()

function getServerForRun(runId: string): SequentialThinkingServer {
  let server = servers.get(runId)
  if (!server) {
    server = new SequentialThinkingServer()
    servers.set(runId, server)
  }
  return server
}

export const handleSequentialThinking = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'sequentialthinking'>
  logger: Logger
  runId: string
}): Promise<{ output: SavantCodeToolOutput<'sequentialthinking'> }> => {
  const { toolCall, logger, runId } = params
  const { thought, thoughtNumber, totalThoughts, nextThoughtNeeded, isRevision, revisesThought, branchFromThought, branchId, needsMoreThoughts } = toolCall.input

  logger.debug({ thoughtNumber, totalThoughts, nextThoughtNeeded }, 'Sequential thought')

  const server = getServerForRun(runId)
  const result = server.processThought({
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

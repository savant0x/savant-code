import type { LoopAgentStepsParams } from '../types'
import type { AddAgentStepFn } from '@savant-code/common/types/contracts/database'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * FID-2026-0819-005 Loop 300: extracted verbatim from `loop-iteration.ts`.
 *
 * Records the completed step via the host's addAgentStep hook — the original
 * `if (newAgentState.runId) { await loopParams.addAgentStep({...}) } else {
 * logger.error(...) }` tail.
 */
export async function recordAgentStep(params: {
  addAgentStep: AddAgentStepFn
  loopParams: LoopAgentStepsParams
  agentState: AgentState
  stepNumber: number
  credits: number
  childrenBefore: number
  messageId: string | null
  status: 'completed' | 'failed'
  errorMessage: string | undefined
  startTime: Date
  logger: Logger
}): Promise<void> {
  const {
    addAgentStep,
    loopParams,
    agentState,
    stepNumber,
    credits,
    childrenBefore,
    messageId,
    status,
    errorMessage,
    startTime,
    logger,
  } = params
  if (agentState.runId) {
    await addAgentStep({
      ...loopParams,
      agentRunId: agentState.runId,
      stepNumber,
      credits,
      childRunIds: agentState.childRunIds.slice(childrenBefore),
      messageId,
      status,
      errorMessage,
      startTime,
    })
  } else {
    logger.error('No runId found for agent state after finishing agent run')
  }
}

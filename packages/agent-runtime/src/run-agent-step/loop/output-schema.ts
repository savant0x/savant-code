import { userMessage } from '@savant-code/common/util/messages'

import { withSystemTags } from '../../util/messages'

import type { LoopAgentStepsParams } from '../types'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * FID-2026-0819-005 Loop 300: extracted verbatim from `loop-iteration.ts`.
 *
 * Check if output is required but missing — injects the set_output steering
 * message and restarts the loop once (`hasRetriedOutputSchema` latches).
 */
export function applyOutputSchemaRestart(params: {
  loopParams: LoopAgentStepsParams
  agentTemplate: AgentTemplate
  currentAgentState: AgentState
  shouldEndTurn: boolean
  hasRetriedOutputSchema: boolean
  logger: Logger
  runId: string
}): { hasRetriedOutputSchema: boolean; shouldEndTurn: boolean } {
  const { loopParams, agentTemplate, currentAgentState, logger, runId } = params
  let { shouldEndTurn } = params
  let { hasRetriedOutputSchema } = params
  if (
    agentTemplate.outputSchema &&
    currentAgentState.output === undefined &&
    shouldEndTurn &&
    !hasRetriedOutputSchema
  ) {
    hasRetriedOutputSchema = true
    logger.warn(
      {
        agentType: loopParams.agentType,
        agentId: currentAgentState.agentId,
        runId,
      },
      'Agent finished without setting required output, restarting loop',
    )

    // Add system message instructing to use set_output
    const outputSchemaMessage = withSystemTags(
      `You must use the "set_output" tool to provide a result that matches the output schema before ending your turn. The output schema is required for this agent.`,
    )

    currentAgentState.messageHistory = [
      ...currentAgentState.messageHistory,
      userMessage({
        content: outputSchemaMessage,
        keepDuringTruncation: true,
      }),
    ]

    // Reset shouldEndTurn to continue the loop
    return { hasRetriedOutputSchema, shouldEndTurn: false }
  }
  return { hasRetriedOutputSchema, shouldEndTurn }
}

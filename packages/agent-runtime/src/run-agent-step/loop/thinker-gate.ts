import { runThinkerConvergenceGate } from '../../tools/thinker-convergence-gate'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * FID-2026-0801-012: Thinker convergence gate (FID-2026-0819-005 Loop 300:
 * extracted verbatim from `loop-iteration.ts`).
 *
 * Runs at the runtime boundary AFTER the native step's tool results are
 * committed to history, and BEFORE the loop-top `output === undefined &&
 * shouldEndTurn` restart check. For the Thinker it builds the
 * FinalArtifact from the session snapshot and sets `agentState.output`
 * for every terminal status — otherwise the restart branch would fire
 * the "You must use set_output" message and reintroduce
 * `structuredOutput: null` (set_output is not in the Thinker's
 * toolNames). Retries keep the loop going with a typed message.
 */
export function applyThinkerConvergenceGate(params: {
  agentTemplate: AgentTemplate
  currentAgentState: AgentState
  shouldEndTurn: boolean
  logger: Logger
  runId: string
}): { shouldEndTurn: boolean } {
  const { agentTemplate, currentAgentState, shouldEndTurn, logger, runId } =
    params
  if (
    agentTemplate.outputMode === 'structured_output' &&
    agentTemplate.toolNames.includes('sequentialthinking')
  ) {
    const gateResult = runThinkerConvergenceGate({
      runId,
      agentState: currentAgentState,
      shouldEndTurn,
      logger,
    })
    if (gateResult.retryAppended) {
      return { shouldEndTurn: false }
    }
  }
  return { shouldEndTurn }
}

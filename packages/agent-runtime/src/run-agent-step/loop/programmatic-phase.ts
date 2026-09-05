import { runProgrammaticStep } from '../../run-programmatic-step'

import type {
  LoopIterationContext,
  LoopIterationState,
} from '../loop-iteration'
import type { LoopAgentStepsParams } from '../types'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { JSONValue } from '@savant-code/common/types/json'

export type ProgrammaticPhaseResult = {
  /** FID-2026-0810-002 Change 5: the raw terminal verdict seen during this
   *  iteration (before any gate overrides it). */
  sawTerminalVerdict: boolean
  n: number | undefined
  totalSteps: number
  shouldEndTurn: boolean
}

/**
 * 1. Run programmatic step first if it exists (FID-2026-0819-005 Loop 300:
 * extracted verbatim from `loop-iteration.ts`). No-op returning
 * `sawTerminalVerdict: false` when the template has no `handleSteps`.
 */
export async function runProgrammaticPhase(params: {
  loopParams: LoopAgentStepsParams
  agentTemplate: AgentTemplate
  state: LoopIterationState
  ctx: LoopIterationContext
  currentAgentState: LoopIterationState['agentState']
  shouldEndTurn: boolean
  totalSteps: number
  nResponses?: string[]
  currentPrompt?: string
  currentParams?: Record<string, JSONValue> | undefined
}): Promise<ProgrammaticPhaseResult> {
  const { loopParams, agentTemplate, state, ctx } = params
  const { localAgentTemplates, runId, system, tools, initialAgentState } = ctx
  let { shouldEndTurn, totalSteps, nResponses, currentPrompt, currentParams } =
    params
  const currentAgentState = params.currentAgentState
  let sawTerminalVerdict = false
  let n: number | undefined = undefined

  if (agentTemplate.handleSteps) {
    const programmaticResult = await runProgrammaticStep({
      ...loopParams,

      agentState: currentAgentState,
      localAgentTemplates,
      nResponses,
      onCostCalculated: async (credits: number) => {
        currentAgentState.creditsUsed += credits
        currentAgentState.directCreditsUsed += credits
      },
      prompt: currentPrompt,
      runId,
      stepNumber: totalSteps,
      stepsComplete: shouldEndTurn,
      system,
      tools,
      template: agentTemplate,
      toolCallParams: currentParams as
        | Record<string, string | number | boolean | null | undefined>
        | undefined,
    })
    const {
      agentState: programmaticAgentState,
      endTurn,
      stepNumber,
      generateN,
    } = programmaticResult
    n = generateN
    if (endTurn) {
      sawTerminalVerdict = true
    }

    Object.assign(initialAgentState, programmaticAgentState)
    state.agentState = initialAgentState
    totalSteps = stepNumber

    shouldEndTurn = endTurn
  }

  return {
    sawTerminalVerdict,
    n,
    totalSteps,
    shouldEndTurn,
  }
}

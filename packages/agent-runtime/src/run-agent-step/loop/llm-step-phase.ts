import { runAgentStep } from '../step'

import type { LoopIterationContext } from '../loop-iteration'
import type { LoopAgentStepsParams } from '../types'
import type { JSONValue } from '@savant-code/common/types/json'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * FID-2026-0819-005 Loop 300: extracted verbatim from `loop-iteration.ts`.
 *
 * The LLM step: invokes runAgentStep with the prepared step prompt and
 * system tokens, then merges the result into the shared initialAgentState.
 */
export async function runLlmStepPhase(params: {
  loopParams: LoopAgentStepsParams
  ctx: LoopIterationContext
  currentAgentState: AgentState
  n: number | undefined
  currentPrompt?: string
  currentParams?: Record<string, JSONValue> | undefined
  stepPrompt: string | undefined
  systemTokens: number | undefined
  totalSteps: number
  shouldEndTurn: boolean
}): Promise<{
  agentState: AgentState
  llmShouldEndTurn: boolean
  hasNativeIncompleteToolCall: boolean
  lastIncompleteToolName: string | undefined
  messageId: string | null
  nResponses: string[] | undefined
}> {
  const {
    loopParams,
    ctx,
    currentAgentState,
    n,
    currentPrompt,
    currentParams,
    stepPrompt,
    systemTokens,
  } = params
  const {
    agentTemplate,
    system,
    tools,
    runId,
    additionalToolDefinitionsWithCache,
    getCachedAdditionalToolDefinitions,
  } = ctx

  const {
    agentState,
    shouldEndTurn: llmShouldEndTurn,
    hasNativeIncompleteToolCall,
    lastIncompleteToolName,
    messageId,
    nResponses: generatedResponses,
  } = await runAgentStep({
    ...loopParams,

    agentState: currentAgentState,
    agentTemplate,
    n,
    prompt: currentPrompt,
    runId,
    spawnParams: currentParams,
    system,
    tools,
    additionalToolDefinitions: additionalToolDefinitionsWithCache,
    // FID-2026-0802-005 L15/H8: reuse the step prompt already computed
    // above and the step-built custom tool data.
    stepPrompt,
    // FID-2026-0815-011 E-01: reuse the system-prompt token count too.
    systemTokens,
    customToolDefinitions: getCachedAdditionalToolDefinitions(),
  })

  return {
    agentState,
    llmShouldEndTurn,
    hasNativeIncompleteToolCall,
    lastIncompleteToolName,
    messageId,
    nResponses: generatedResponses,
  }
}

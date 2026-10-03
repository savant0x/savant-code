import { serializeCacheDebugCorrelation } from '@savant-code/common/util/cache-debug'

import type { CacheDebugHooks, CacheDebugSetup } from './cache-debug'
import type { RunAgentStepParams, RunAgentStepResult } from './types'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * Handles the `n` parameter path of a step: asks the LLM for multiple
 * responses and parses the resulting JSON array. Behavior identical to the
 * inline block it was extracted from — the run's `n` value replaces the
 * destructured `params.n` only.
 */
export async function handleNParameterStep(
  params: {
    runParams: RunAgentStepParams
    agentState: AgentState
    n: number
    onCostCalculated: (credits: number) => Promise<void>
  } & CacheDebugHooks &
    Pick<CacheDebugSetup, 'cacheDebugCorrelation'>,
): Promise<RunAgentStepResult> {
  const {
    runParams,
    agentState,
    n,
    onCostCalculated,
    cacheDebugCorrelation,
    onCacheDebugProviderRequestBuilt,
    onCacheDebugUsageReceived,
  } = params

  const result = await runParams.promptAiSdk({
    ...runParams,
    messages: agentState.messageHistory,
    model: runParams.agentTemplate.model,
    modelRoute: runParams.agentTemplate.modelRoute,
    n,
    onCostCalculated,
    cacheDebugCorrelation: cacheDebugCorrelation
      ? serializeCacheDebugCorrelation(cacheDebugCorrelation)
      : undefined,
    onCacheDebugProviderRequestBuilt,
    onCacheDebugUsageReceived,
  })

  if (result.aborted) {
    return {
      agentState,
      fullResponse: '',
      shouldEndTurn: true,
      hasNativeIncompleteToolCall: false,
      messageId: null,
      nResponses: undefined,
    }
  }

  const responsesString = result.value
  let nResponses: string[]
  try {
    nResponses = JSON.parse(responsesString) as string[]
    if (!Array.isArray(nResponses)) {
      if (n > 1) {
        throw new Error(
          `Expected JSON array response from LLM when n > 1, got non-array: ${responsesString.slice(0, 50)}`,
        )
      }
      // If it parsed but isn't an array, treat as single response
      nResponses = [responsesString]
    }
  } catch (e) {
    if (n > 1) {
      throw e
    }
    // If parsing fails, treat as single raw response (common for n=1)
    nResponses = [responsesString]
  }

  return {
    agentState,
    fullResponse: responsesString,
    shouldEndTurn: false,
    hasNativeIncompleteToolCall: false,
    messageId: null,
    nResponses,
  }
}

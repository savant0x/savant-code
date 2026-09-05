import { AbortError } from '@savant-code/common/util/error'

import { prepareStepContext } from './context-tokens'
import { getOrCreateEnforcement } from '../echo/enforcement'
import { appendGroundingRefresh } from '../echo/grounding'
import {
  applyStepBoundaryTail,
  applyTurnEndEnforcement,
} from './loop/boundary-gates'
import { applyUngroundedCompletionGate } from './loop/completion-gate'
import { runLlmStepPhase } from './loop/llm-step-phase'
import {
  applyNativeStrikeHandling,
  buildStepExhaustedError,
} from './loop/native-strikes'
import { applyOutputSchemaRestart } from './loop/output-schema'
import { runProgrammaticPhase } from './loop/programmatic-phase'
import { recordAgentStep } from './loop/step-record'
import { applyThinkerConvergenceGate } from './loop/thinker-gate'

import type { ContextCompactor } from '../context-compactor'
import type { LoopAgentStepsParams } from './types'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'
import type { AgentState } from '@savant-code/common/types/session-state'
import type { CustomToolDefinitions } from '@savant-code/common/util/file'
import type { ToolSet } from 'ai'

export type LoopIterationState = {
  agentState: AgentState
  shouldEndTurn: boolean
  totalSteps: number
  nResponses?: string[]
  consecutiveNativeIncompleteSteps: number
  hasRetriedOutputSchema: boolean
  currentPrompt?: string
  currentParams?: Record<string, JSONValue> | undefined
}

export type LoopIterationContext = {
  agentTemplate: AgentTemplate
  system: string
  tools: ToolSet
  runId: string
  toolsForTokenCount: Array<{
    name: string
    description?: string
    input_schema?: JSONValue
  }>
  contextCompactor: ContextCompactor
  additionalToolDefinitionsWithCache: () => Promise<CustomToolDefinitions>
  getCachedAdditionalToolDefinitions: () => CustomToolDefinitions | undefined
  localAgentTemplates: Record<string, AgentTemplate>
  logger: Logger
  signal: AbortSignal
  initialAgentState: AgentState
} /**
 * Runs one iteration of the agent loop: step prompt + token counting +
 * compaction, the programmatic step, the output-schema retry, the LLM step
 * (runAgentStep), step bookkeeping, steering, and the ECHO compliance step
 * boundary. Mutates `state` in place and returns `shouldContinue` — when
 * false the caller breaks the loop (mirrors the original `if (shouldEndTurn)
 * break`).
 */
export async function runLoopIteration(params: {
  loopParams: LoopAgentStepsParams
  state: LoopIterationState
  ctx: LoopIterationContext
}): Promise<{ shouldContinue: boolean }> {
  const { loopParams, state, ctx } = params
  const {
    agentTemplate,
    system,
    runId,
    toolsForTokenCount,
    contextCompactor,
    additionalToolDefinitionsWithCache,
    logger,
    signal,
    initialAgentState,
  } = ctx
  let {
    shouldEndTurn,
    totalSteps,
    nResponses,
    consecutiveNativeIncompleteSteps,
    hasRetriedOutputSchema,
    currentPrompt,
    currentParams,
  } = state
  let currentAgentState = state.agentState
  // FID-2026-0822-003: raw terminal verdict seen during this iteration
  // (before any gate overrides it).
  let sawTerminalVerdict = false

  if (signal.aborted) {
    throw new AbortError()
  }

  totalSteps++
  const startTime = new Date()
  let n: number | undefined = undefined

  // FID-2026-0802-005 L15/H8: compute the step prompt and refresh the context
  // token count / compaction state for this iteration.
  const { stepPrompt, systemTokens } = await prepareStepContext({
    loopParams,
    agentTemplate,
    agentState: currentAgentState,
    system,
    toolsForTokenCount,
    contextCompactor,
    logger,
    additionalToolDefinitionsWithCache,
  })
  const prog = await runProgrammaticPhase({
    loopParams,
    agentTemplate,
    state,
    ctx,
    currentAgentState,
    shouldEndTurn,
    totalSteps,
    nResponses,
    currentPrompt,
    currentParams,
  })
  sawTerminalVerdict = prog.sawTerminalVerdict
  n = prog.n
  totalSteps = prog.totalSteps
  shouldEndTurn = prog.shouldEndTurn
  currentAgentState = state.agentState

  // Check if output is required but missing — restart-once latch (Loop 300:
  // body extracted to loop/output-schema.ts).
  ;({ hasRetriedOutputSchema, shouldEndTurn } = applyOutputSchemaRestart({
    loopParams,
    agentTemplate,
    currentAgentState,
    shouldEndTurn,
    hasRetriedOutputSchema,
    logger,
    runId,
  }))

  // End turn if programmatic step ended turn, or if the previous runAgentStep ended turn
  const writeBack = (): void => {
    Object.assign(state, {
      agentState: currentAgentState,
      shouldEndTurn,
      totalSteps,
      nResponses,
      consecutiveNativeIncompleteSteps,
      hasRetriedOutputSchema,
      currentPrompt,
      currentParams,
    })
  }
  const shouldContinue = !shouldEndTurn
  if (!shouldContinue) {
    writeBack()
    return { shouldContinue }
  }
  const creditsBefore = currentAgentState.directCreditsUsed
  const childrenBefore = currentAgentState.childRunIds.length

  const llm = await runLlmStepPhase({
    loopParams,
    ctx,
    currentAgentState,
    n,
    currentPrompt,
    currentParams,
    stepPrompt,
    systemTokens,
    totalSteps,
    shouldEndTurn,
  })
  const {
    agentState: newAgentState,
    llmShouldEndTurn,
    hasNativeIncompleteToolCall,
    lastIncompleteToolName,
    messageId,
  } = llm
  nResponses = llm.nResponses

  if (llmShouldEndTurn) {
    sawTerminalVerdict = true
  }

  Object.assign(initialAgentState, newAgentState)
  currentAgentState = initialAgentState

  let stepStatus: 'completed' | 'failed' = 'completed'
  let stepErrorMessage: string | undefined
  if (hasNativeIncompleteToolCall) {
    consecutiveNativeIncompleteSteps += 1
    const strike = applyNativeStrikeHandling({
      currentAgentState,
      consecutiveNativeIncompleteSteps,
      lastIncompleteToolName,
    })
    if (strike.exhausted) {
      stepStatus = 'failed'
      stepErrorMessage = buildStepExhaustedError(lastIncompleteToolName)
    }
    shouldEndTurn = false
  } else {
    // "Consecutive" means no intervening normal text, valid tool result, or
    // unrelated tool error. Any non-native-incomplete step breaks recovery
    // streaks before the normal turn decision is applied.
    consecutiveNativeIncompleteSteps = 0
    shouldEndTurn = llmShouldEndTurn
  }

  const boundaryDeps = { currentAgentState, logger }

  // FID-2026-0810-002 Change 5: first-turn completion gate (LLM path). A
  // text-only completion by an ungrounded main agent is blocked, steered,
  // and looped; after the retry cap the gate disarms with a one-time notice.
  ;({ agentState: currentAgentState, shouldEndTurn } =
    applyUngroundedCompletionGate(currentAgentState, shouldEndTurn))
  // FID-2026-0801-012: Thinker convergence gate.
  // Runs at the runtime boundary AFTER the native step's tool results are
  // committed to history, and BEFORE the loop-top `output === undefined &&
  // shouldEndTurn` restart check. For the Thinker it builds the
  // FinalArtifact from the session snapshot and sets `agentState.output`
  // for every terminal status — otherwise the restart branch would fire
  // the "You must use set_output" message and reintroduce
  // `structuredOutput: null` (set_output is not in the Thinker's
  // toolNames). Retries keep the loop going with a typed message.
  shouldEndTurn = applyTurnEndEnforcement(boundaryDeps, shouldEndTurn)

  ;({ shouldEndTurn } = applyThinkerConvergenceGate({
    agentTemplate,
    currentAgentState,
    shouldEndTurn,
    logger,
    runId,
  }))

  await recordAgentStep({
    addAgentStep: loopParams.addAgentStep,
    loopParams,
    agentState: newAgentState,
    stepNumber: totalSteps,
    credits: newAgentState.directCreditsUsed - creditsBefore,
    childrenBefore,
    messageId,
    status: stepStatus,
    errorMessage: stepErrorMessage,
    startTime,
    logger,
  })

  if (stepErrorMessage !== undefined) {
    throw new Error(stepErrorMessage)
  }

  currentPrompt = undefined
  currentParams = undefined

  const steered = loopParams.drainSteeringMessages?.()

  // Steering flush → ECHO compliance → post-terminal breaker (Loop 300:
  // composed sequence extracted to loop/boundary-gates.ts).
  const boundary = applyStepBoundaryTail(boundaryDeps, {
    loopParams,
    steered: steered ?? [],
    sawTerminalVerdict,
    shouldEndTurn,
    stepNumber: totalSteps,
  })
  shouldEndTurn = boundary.shouldEndTurn

  // Adaptive grounding refreshes are evaluated at every internal step. The
  // helper is the single writer for the replacement refresh message; this
  // keeps the 12-step/time backstop effective even when one user turn contains
  // many tool/LLM iterations.
  if (!currentAgentState.parentId) {
    const refresh = getOrCreateEnforcement(currentAgentState).onStepBoundary()
    appendGroundingRefresh(currentAgentState, refresh.refreshText)
  }
  writeBack()

  // FID-2026-0822-003: a hard post-terminal end must stop the caller even
  // if it only honors the returned flag.
  return { shouldContinue: !boundary.hardEnd }
}

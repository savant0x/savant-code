import { AbortError } from '@savant-code/common/util/error'
import { userMessage } from '@savant-code/common/util/messages'

import { getOrCreateEnforcement } from '../echo/enforcement'
import { appendGroundingRefresh } from '../echo/grounding'
import { runProgrammaticStep } from '../run-programmatic-step'
import { NATIVE_TOOL_CALL_RECOVERY_EXHAUSTED_MESSAGE } from './constants'
import { prepareStepContext } from './context-tokens'
import { runAgentStep } from './step'
import { runThinkerConvergenceGate } from '../tools/thinker-convergence-gate'
import { buildUserMessageContent, withSystemTags } from '../util/messages'

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
}

/**
 * FID-2026-0810-002 Change 5: first-turn completion gate. When a MAIN agent
 * would end its turn while the protocol is unread (and the enforcement gate is
 * armed), inject corrective steering mirroring the existing ECHO_COMPLIANCE
 * pattern and force the loop to continue so the boot reads actually happen.
 * After the retry cap the completion gate disarms with a one-time notice and
 * the turn is allowed to proceed. Subagents (parentId) are exempt.
 */
function applyUngroundedCompletionGate(
  agentState: AgentState,
  wouldEndTurn: boolean,
): { agentState: AgentState; shouldEndTurn: boolean } {
  if (!wouldEndTurn || agentState.parentId) {
    return { agentState, shouldEndTurn: wouldEndTurn }
  }
  const enforcement = getOrCreateEnforcement(agentState)
  if (!enforcement) {
    return { agentState, shouldEndTurn: wouldEndTurn }
  }
  const result = enforcement.evaluateUngroundedTurnEnd()
  const text = result.steering ?? result.notice
  if (!result.blocked && !text) {
    return { agentState, shouldEndTurn: wouldEndTurn }
  }
  agentState.messageHistory = [
    ...agentState.messageHistory,
    userMessage({
      content: buildUserMessageContent(text!, undefined, undefined),
      tags: ['ECHO_COMPLIANCE'],
      keepDuringTruncation: true,
    }),
  ]
  if (result.blocked) {
    return { agentState, shouldEndTurn: false }
  }
  // Disarm notice: allow the turn to proceed (bounded escape hatch).
  return { agentState, shouldEndTurn: wouldEndTurn }
}

/**
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
    tools,
    runId,
    toolsForTokenCount,
    contextCompactor,
    additionalToolDefinitionsWithCache,
    getCachedAdditionalToolDefinitions,
    localAgentTemplates,
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

  if (signal.aborted) {
    throw new AbortError()
  }

  totalSteps++
  const startTime = new Date()

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

  // FID-2026-0811-015: one shared turn-end evaluator is used by both
  // programmatic and LLM completion paths. It emits bounded corrective
  // context and keeps blocked turns inside the loop for self-correction.
  const applyTurnEndEnforcement = (ending: boolean): boolean => {
    if (!ending || currentAgentState.parentId) return ending
    const enforcement = getOrCreateEnforcement(currentAgentState)
    const result = enforcement.evaluateTurnEnd()
    if (!result.blocked && !result.report) return ending
    currentAgentState.messageHistory = [
      ...currentAgentState.messageHistory,
      userMessage({
        content: buildUserMessageContent(
          result.report || 'ECHO turn-end enforcement blocked completion.',
          undefined,
          undefined,
        ),
        tags: ['ECHO_COMPLIANCE'],
        keepDuringTruncation: true,
      }),
    ]
    return result.blocked ? false : ending
  }

  // 1. Run programmatic step first if it exists
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

    Object.assign(initialAgentState, programmaticAgentState)
    currentAgentState = initialAgentState
    totalSteps = stepNumber

    shouldEndTurn = endTurn

    // FID-2026-0810-002 Change 5: the completion gate runs on the
    // programmatic end-turn path TOO — before the output-schema restart
    // branch and before the `if (!shouldContinue) return` below — so a
    // handleSteps main agent that ends its turn programmatically cannot skip
    // grounding. Steering runs before the output-schema restart, so a
    // structured-output agent's "must use set_output" restart is never
    // starved while ungrounded: grounding completes first.
    ;({ agentState: currentAgentState, shouldEndTurn } =
      applyUngroundedCompletionGate(currentAgentState, shouldEndTurn))
    shouldEndTurn = applyTurnEndEnforcement(shouldEndTurn)
  }

  // Check if output is required but missing
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
    shouldEndTurn = false
  }

  // End turn if programmatic step ended turn, or if the previous runAgentStep ended turn
  const shouldContinue = !shouldEndTurn
  if (!shouldContinue) {
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
    return { shouldContinue }
  }

  const creditsBefore = currentAgentState.directCreditsUsed
  const childrenBefore = currentAgentState.childRunIds.length
  const {
    agentState: newAgentState,
    shouldEndTurn: llmShouldEndTurn,
    hasNativeIncompleteToolCall,
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

  Object.assign(initialAgentState, newAgentState)
  currentAgentState = initialAgentState
  nResponses = generatedResponses

  let stepStatus: 'completed' | 'failed' = 'completed'
  let stepErrorMessage: string | undefined
  if (hasNativeIncompleteToolCall) {
    consecutiveNativeIncompleteSteps += 1
    if (consecutiveNativeIncompleteSteps >= 2) {
      stepStatus = 'failed'
      stepErrorMessage = NATIVE_TOOL_CALL_RECOVERY_EXHAUSTED_MESSAGE
    }
    shouldEndTurn = false
  } else {
    // "Consecutive" means no intervening normal text, valid tool result, or
    // unrelated tool error. Any non-native-incomplete step breaks recovery
    // streaks before the normal turn decision is applied.
    consecutiveNativeIncompleteSteps = 0
    shouldEndTurn = llmShouldEndTurn
  }

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
  shouldEndTurn = applyTurnEndEnforcement(shouldEndTurn)

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
      shouldEndTurn = false
    }
  }

  if (newAgentState.runId) {
    await loopParams.addAgentStep({
      ...loopParams,
      agentRunId: newAgentState.runId,
      stepNumber: totalSteps,
      credits: newAgentState.directCreditsUsed - creditsBefore,
      childRunIds: newAgentState.childRunIds.slice(childrenBefore),
      messageId,
      status: stepStatus,
      errorMessage: stepErrorMessage,
      startTime,
    })
  } else {
    logger.error('No runId found for agent state after finishing agent run')
  }

  if (stepErrorMessage !== undefined) {
    throw new Error(stepErrorMessage)
  }

  currentPrompt = undefined
  currentParams = undefined

  // Steering: if the host fed user messages while this step ran, append them
  // now (the step's LLM call + tools have completed, so history is in a clean
  // state) and keep the turn going so the agent runs a second step that can
  // see (and act on) the new message.
  const steered = loopParams.drainSteeringMessages?.()
  if (steered?.length) {
    currentAgentState.messageHistory = [
      ...currentAgentState.messageHistory,
      ...steered.map((text) =>
        userMessage({
          content: buildUserMessageContent(text, undefined, undefined),
          tags: ['USER_PROMPT'],
          keepDuringTruncation: true,
        }),
      ),
    ]
    shouldEndTurn = false
  }

  // FID-2026-0804-009: harness ECHO compliance — Law 3 (verify-after-write)
  // + mechanical Verifier-criteria flag + FID escalation, evaluated at each
  // step boundary (no-op mid-batch; only fires when the turn is ending).
  // Emits non-blocking compliance_warning receipts and, when violations
  // exist, injects corrective steering so the running agent self-corrects
  // (bounded by the tracker's steering budget — never loops forever).
  // MAIN-LOOP ONLY (code-review finding): subagent loops share the parent
  // run's tracker for RECORDING (tool-executor) but must never evaluate or
  // steer here — a Forge/basher subagent can't act on a Verifier-spawn
  // directive injected into its own message history. Programmatic-only
  // turns exit at the `if (shouldEndTurn) break` above before this block,
  // so handleSteps-driven runs intentionally never evaluate here.
  const echoCompliance = currentAgentState.echoCompliance
  if (
    echoCompliance &&
    echoCompliance.mode !== 'off' &&
    !currentAgentState.parentId
  ) {
    const violations = echoCompliance.evaluateAtStepBoundary({
      stepNumber: totalSteps,
      endingTurn: shouldEndTurn,
    })
    if (violations.length > 0) {
      for (const violation of violations) {
        loopParams.onResponseChunk({
          type: 'compliance_warning',
          ...violation,
        })
      }
      const steering = echoCompliance.takeSteeringMessages()
      if (steering.length > 0) {
        currentAgentState.messageHistory = [
          ...currentAgentState.messageHistory,
          ...steering.map((text) =>
            userMessage({
              content: buildUserMessageContent(text, undefined, undefined),
              tags: ['ECHO_COMPLIANCE'],
              keepDuringTruncation: true,
            }),
          ),
        ]
        shouldEndTurn = false
      }
    }
  }

  // Adaptive grounding refreshes are evaluated at every internal step. The
  // helper is the single writer for the replacement refresh message; this
  // keeps the 12-step/time backstop effective even when one user turn contains
  // many tool/LLM iterations.
  if (!currentAgentState.parentId) {
    const refresh = getOrCreateEnforcement(currentAgentState).onStepBoundary()
    appendGroundingRefresh(currentAgentState, refresh.refreshText)
  }

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

  return { shouldContinue: true }
}

// FID-2026-0819-005 Loop 274: post-stream decision, anti-runaway guard, and
// settlement for one agent step, extracted verbatim from step.ts (with two
// declared identifier scopes: stream-outcome fields arrive via `stream`, and
// the original `agentState = {...}` rebinding becomes `settledState`).
import { TOOLS_WHICH_WONT_FORCE_NEXT_STEP } from '@savant-code/common/tools/constants'
import { userMessage } from '@savant-code/common/util/messages'

import { setActivity } from '../../util/activity-tracking'
import { withSystemTags, expireMessages } from '../../util/messages'
import { isThinkOnlyResponse } from '../../util/think-tags'
import { evaluateGoalCondition } from '../goal-evaluation'
import {
  buildToolCallSignature,
  updateAndEvaluateRunawayGuards,
} from '../runaway-guards'

import type { processStream } from '../../tools/stream-parser'
import type { RunAgentStepParams, RunAgentStepResult } from '../types'

type ProcessStreamResult = Awaited<ReturnType<typeof processStream>>

/** The outcome of processStream, sliced for the settlement phase. */
export type StepStreamOutcome = Omit<ProcessStreamResult, 'fullResponse'>

/**
 * Post-stream normalization, decisions, guards, and settlement (verbatim
 * from step.ts; see the file header for the declared renames).
 */
export function finalizeStep(deps: {
  params: RunAgentStepParams
  agentState: RunAgentStepResult['agentState']
  fullResponse: string
  stream: StepStreamOutcome
  iterationNum: number
  startTime: number
  stepCreditsUsed: number
}): RunAgentStepResult {
  const {
    params,
    agentState,
    fullResponse,
    stream,
    iterationNum,
    startTime,
    stepCreditsUsed,
  } = deps
  const { agentType, logger, onResponseChunk, userInputId } = params
  const { agentTemplate, prompt, system, traceWriter } = params
  const { model } = agentTemplate
  const { agentContext } = agentState

  // FID-2026-0718-009 M5: model stream complete — idle until next event.
  setActivity(agentState, { kind: 'idle', since: Date.now() }, onResponseChunk)

  agentState.messageHistory = expireMessages(
    agentState.messageHistory,
    'agentStep',
  )

  // Handle /compact command: replace message history with the summary.
  // FID-2026-0822-001 RC3: legacy fallback ONLY for agents without
  // handleSteps. handleSteps agents own /compact through the serialized
  // savant interceptor (force context-pruner pipeline); letting this run
  // for them races that pipeline and can replace structured memory with a
  // raw model response (or error text).
  const wasCompacted =
    prompt &&
    !agentTemplate.handleSteps &&
    (prompt.toLowerCase() === '/compact' || prompt.toLowerCase() === 'compact')
  if (wasCompacted) {
    agentState.messageHistory = [
      userMessage(
        withSystemTags(
          `The following is a summary of the conversation between you and the user. The conversation continues after this summary:\n\n${fullResponse}`,
        ),
      ),
    ]
    logger.debug({ summary: fullResponse }, 'Compacted messages')
  }

  const hasNoToolResults =
    stream.toolCalls.filter(
      (call) => !TOOLS_WHICH_WONT_FORCE_NEXT_STEP.includes(call.toolName),
    ).length === 0 &&
    stream.toolResults.filter(
      (result) => !TOOLS_WHICH_WONT_FORCE_NEXT_STEP.includes(result.toolName),
    ).length === 0 &&
    !stream.hadToolCallError // Tool call errors should also force another step so the agent can retry

  const hasTaskCompleted = stream.toolCalls.some(
    (call) =>
      call.toolName === 'task_completed' || call.toolName === 'end_turn',
  )

  // If the response is only <think>...</think> scaffolding (including orphan
  // </think> closes that native-reasoning providers sometimes leak into
  // content), the model was just thinking and should continue rather than end.
  const isThinkOnly = hasNoToolResults && isThinkOnlyResponse(fullResponse)

  // If the agent has the task_completed tool, it must be called to end its turn.
  const requiresExplicitCompletion =
    agentTemplate.toolNames.includes('task_completed')

  let shouldEndTurn: boolean
  if (requiresExplicitCompletion) {
    // For models requiring explicit completion, only end turn when:
    // - task_completed is called, OR
    // - end_turn is called (backward compatibility)
    shouldEndTurn = hasTaskCompleted
  } else {
    // For other models, also end turn when there are no tool calls
    // Exception: if the response is only <think> tags, continue the turn
    shouldEndTurn = hasTaskCompleted || (hasNoToolResults && !isThinkOnly)
  }

  // FID-2026-0725-083: Goal evaluation — see evaluateGoalCondition.
  shouldEndTurn = evaluateGoalCondition({
    shouldEndTurn,
    goalCondition: agentState.goalCondition,
    fullResponse,
    logger,
  })

  // FID-2026-0822-002: mechanical anti-runaway guards. Detect non-progress
  // patterns (identical repeated tool calls, consecutive tool-error retry
  // steps, consecutive think-only responses) and end the turn here instead
  // of burning LLM steps to the MAX_AGENT_STEPS cap.
  const guardVerdict = updateAndEvaluateRunawayGuards(
    {
      lastToolCallSignature: agentState.lastToolCallSignature,
      consecutiveIdenticalToolSignatures:
        agentState.consecutiveIdenticalToolSignatures ?? 0,
      consecutiveToolErrorSteps: agentState.consecutiveToolErrorSteps ?? 0,
      consecutiveThinkOnlyResponses:
        agentState.consecutiveThinkOnlyResponses ?? 0,
    },
    {
      toolSignature: buildToolCallSignature(stream.toolCalls),
      hadToolCallError: stream.hadToolCallError,
      isThinkOnly,
    },
  )
  agentState.lastToolCallSignature = guardVerdict.counters.lastToolCallSignature
  agentState.consecutiveIdenticalToolSignatures =
    guardVerdict.counters.consecutiveIdenticalToolSignatures
  agentState.consecutiveToolErrorSteps =
    guardVerdict.counters.consecutiveToolErrorSteps
  agentState.consecutiveThinkOnlyResponses =
    guardVerdict.counters.consecutiveThinkOnlyResponses
  if (guardVerdict.tripReason) {
    const notice = `Turn auto-ended by anti-runaway guard (${guardVerdict.tripReason}). The last several steps made no progress; send a new message to continue.`
    logger.warn({ tripReason: guardVerdict.tripReason }, notice)
    onResponseChunk(`\n\n${notice}\n`)
    shouldEndTurn = true
  }

  const settledState = {
    ...agentState,
    stepsRemaining: agentState.stepsRemaining - 1,
    agentContext,
  }

  // Capture the assistant response and tool results added during this step
  traceWriter?.recordStep({
    agentId: settledState.agentId,
    agentType: String(agentType),
    runId: settledState.runId,
    userInputId,
    step: iterationNum,
    system,
    messages: settledState.messageHistory,
  })

  logger.debug(
    {
      iteration: iterationNum,
      agentId: settledState.agentId,
      model,
      prompt,
      shouldEndTurn,
      duration: Date.now() - startTime,
      // FID-2026-0815-012 G-01: summarize only. `fullResponse`, `toolCalls`,
      // and `toolResults` are captured by the trace writer (via
      // messageHistory above) and the persisted chat file, so re-serializing
      // them here deep-copies large payloads every step for no observability
      // gain. Keep the cheap scalar summary fields instead.
      messageCount: settledState.messageHistory.length,
      stepCreditsUsed,
    },
    `End agent ${agentType} step ${iterationNum} (${userInputId}${prompt ? ` - Prompt: ${prompt.slice(0, 20)}` : ''})`,
  )

  return {
    agentState: settledState,
    fullResponse,
    shouldEndTurn,
    hasNativeIncompleteToolCall: stream.hasNativeIncompleteToolCall,
    lastIncompleteToolName: stream.lastIncompleteToolName,
    messageId: stream.messageId,
    nResponses: undefined,
  }
}

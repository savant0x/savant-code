import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'
import {
  supportsAssistantPrefill,
  supportsCacheControl,
} from '@savant-code/common/old-constants'
import { TOOLS_WHICH_WONT_FORCE_NEXT_STEP } from '@savant-code/common/tools/constants'
import { serializeCacheDebugCorrelation } from '@savant-code/common/util/cache-debug'
import { systemMessage, userMessage } from '@savant-code/common/util/messages'

import { getAgentStreamFromTemplate } from '../prompt-agent-stream'
import { createCacheDebugSetup } from './cache-debug'
import { STEP_WARNING_MESSAGE } from './constants'
import { evaluateGoalCondition } from './goal-evaluation'
import { handleNParameterStep } from './n-parameter'
import { getAgentPrompt } from '../templates/strings'
import { processStream } from '../tools/stream-parser'
import { setActivity } from '../util/activity-tracking'
import { withSystemTags, expireMessages } from '../util/messages'
import { isThinkOnlyResponse } from '../util/think-tags'
import { countTokens } from '../util/token-counter'

import type { RunAgentStepParams, RunAgentStepResult } from './types'
import type { ToolMessage } from '@savant-code/common/types/messages/savant-code-message'

export const runAgentStep = async (
  params: RunAgentStepParams,
): Promise<RunAgentStepResult> => {
  const {
    agentType,
    clientSessionId,
    fileContext,
    agentTemplate,
    fingerprintId,
    localAgentTemplates,
    logger,
    prompt,
    repoId,
    spawnParams,
    system,
    userId,
    userInputId,
    onResponseChunk,
    trackEvent,
    additionalToolDefinitions,
  } = params
  let agentState = params.agentState

  const { agentContext } = agentState

  const startTime = Date.now()

  // Generates a unique ID for each main prompt run (ie: a step of the agent loop)
  // This is used to link logs within a single agent loop
  const agentStepId = crypto.randomUUID()
  trackEvent({
    event: AnalyticsEvent.AGENT_STEP,
    userId: userId ?? '',
    properties: {
      agentStepId,
      clientSessionId,
      fingerprintId,
      userInputId,
      userId: userId ?? null,
      repoName: repoId ?? null,
    },
    logger,
  })

  if (agentState.stepsRemaining <= 0) {
    logger.warn(
      `Detected too many consecutive assistant messages without user prompt`,
    )

    onResponseChunk(`${STEP_WARNING_MESSAGE}\n\n`)

    // Update message history to include the warning
    agentState = {
      ...agentState,
      messageHistory: [
        ...expireMessages(agentState.messageHistory, 'userPrompt'),
        userMessage(
          withSystemTags(
            `The assistant has responded too many times in a row. The assistant's turn has automatically been ended. The maximum number of responses can be configured via maxAgentSteps.`,
          ),
        ),
      ],
    }
    return {
      agentState,
      fullResponse: STEP_WARNING_MESSAGE,
      shouldEndTurn: true,
      hasNativeIncompleteToolCall: false,
      messageId: null,
    }
  }

  // FID-2026-0802-005 L15: the step prompt is computed ONCE per step in
  // loopAgentSteps (which needs it for token counting) and passed down —
  // previously runAgentStep recomputed it for identical inputs. Callers that
  // invoke runAgentStep directly (tests) still get the computed fallback.
  const stepPrompt =
    params.stepPrompt ??
    (await getAgentPrompt({
      ...params,
      agentTemplate,
      promptType: { type: 'stepPrompt' },
      fileContext,
      agentState,
      agentTemplates: localAgentTemplates,
      logger,
      additionalToolDefinitions,
    }))

  // FID-2026-0815-004 (F-03): replace the buildArray(…spread…, falsey-filter)
  // construction with a conditional append. buildArray only ever removed the
  // `false` from `stepPrompt && …` when stepPrompt was absent; the ternary
  // below covers that case exactly, and expireMessages' fast-path avoids the
  // allocation when nothing expires (4 allocations/step → 2, or 1 when there
  // is no stepPrompt).
  const filtered = expireMessages(agentState.messageHistory, 'agentStep')
  const stepPromptMessage = stepPrompt
    ? userMessage({
        content: stepPrompt,
        tags: ['STEP_PROMPT'],

        // James: Deprecate the below, only use tags, which are not prescriptive.
        timeToLive: 'agentStep' as const,
        keepDuringTruncation: true,
      })
    : undefined

  agentState.messageHistory = stepPromptMessage
    ? [...filtered, stepPromptMessage]
    : filtered

  const { model } = agentTemplate

  // A step can start with the history ending on an assistant message — e.g. a
  // continuation after a think-only response for an agent with no stepPrompt.
  // Claude 4.6+ rejects such requests as unsupported assistant prefill, so end
  // the conversation with a user message instead.
  const lastMessage =
    agentState.messageHistory[agentState.messageHistory.length - 1]
  if (lastMessage?.role === 'assistant' && !supportsAssistantPrefill(model)) {
    agentState.messageHistory = [
      ...agentState.messageHistory,
      userMessage({
        content: withSystemTags('Continue from where you left off.'),
        timeToLive: 'agentStep' as const,
        keepDuringTruncation: true,
      }),
    ]
  }

  let stepCreditsUsed = 0

  const onCostCalculated = async (credits: number) => {
    stepCreditsUsed += credits
    agentState.creditsUsed += credits
    agentState.directCreditsUsed += credits
  }

  const iterationNum = agentState.messageHistory.length
  // system is a plain string; count it directly rather than JSON-stringifying
  // it (which would add quotes and escape every newline). FID-2026-0815-011
  // E-01: reuse the count computed in prepareStepContext so the invariant
  // system prompt is not re-tokenized every step (fallback covers direct
  // callers/tests).
  const systemTokens = params.systemTokens ?? countTokens(system)

  const {
    cacheDebugCorrelation,
    onCacheDebugProviderRequestBuilt,
    onCacheDebugUsageReceived,
  } = createCacheDebugSetup({
    agentType: String(agentType),
    system,
    tools: params.tools,
    logger,
    projectRoot: fileContext.projectRoot,
    runId: agentState.runId,
    userInputId,
    agentStepId,
    model,
    messageHistory: agentState.messageHistory,
  })

  // Full message histories go to the trace writer, which appends each message
  // exactly once (see TraceWriter).
  params.traceWriter?.recordStep({
    agentId: agentState.agentId,
    agentType: String(agentType),
    runId: agentState.runId,
    userInputId,
    step: iterationNum,
    system,
    messages: agentState.messageHistory,
  })

  // Log a summary only: the full message history, system prompt, and agent
  // template are large and logging them every step bloats log files
  // quadratically over the course of a chat.
  logger.debug(
    {
      iteration: iterationNum,
      runId: agentState.runId,
      model,
      duration: Date.now() - startTime,
      contextTokenCount: agentState.contextTokenCount,
      messageCount: agentState.messageHistory.length,
      prompt,
      params: spawnParams,
      systemTokens,
      agentTemplateId: agentTemplate.id,
      toolNames: params.tools ? Object.keys(params.tools) : undefined,
    },
    `Start agent ${agentType} step ${iterationNum} (${userInputId}${prompt ? ` - Prompt: ${prompt.slice(0, 20)}` : ''})`,
  )

  // Handle n parameter for generating multiple responses
  if (params.n !== undefined) {
    return handleNParameterStep({
      runParams: params,
      agentState,
      n: params.n,
      onCostCalculated,
      cacheDebugCorrelation,
      onCacheDebugProviderRequestBuilt,
      onCacheDebugUsageReceived,
    })
  }

  let fullResponse = ''
  const toolResults: ToolMessage[] = []

  // FID-2026-0718-009 M4: model stream starting — set activity to thinking.
  setActivity(
    agentState,
    { kind: 'thinking', startedAt: Date.now() },
    onResponseChunk,
  )

  // Raw stream from AI SDK
  const stream = getAgentStreamFromTemplate({
    ...params,
    agentId: agentState.parentId ? agentState.agentId : undefined,
    cacheDebugCorrelation: cacheDebugCorrelation
      ? serializeCacheDebugCorrelation(cacheDebugCorrelation)
      : undefined,
    includeCacheControl: supportsCacheControl(agentTemplate.model),
    messages: [systemMessage(system), ...agentState.messageHistory],
    onCacheDebugProviderRequestBuilt,
    onCacheDebugUsageReceived,
    template: agentTemplate,
    onCostCalculated,
  })

  const {
    fullResponse: fullResponseAfterStream,
    hadToolCallError,
    hasNativeIncompleteToolCall,
    messageId,
    toolCalls,
    toolResults: newToolResults,
  } = await processStream({
    ...params,
    agentContext,
    agentState,
    agentStepId,
    agentTemplate,
    fullResponse,
    messages: agentState.messageHistory,
    repoId,
    stream,
    onCostCalculated,
  })

  toolResults.push(...newToolResults)

  fullResponse = fullResponseAfterStream

  // FID-2026-0718-009 M5: model stream complete — idle until next event.
  setActivity(agentState, { kind: 'idle', since: Date.now() }, onResponseChunk)

  agentState.messageHistory = expireMessages(
    agentState.messageHistory,
    'agentStep',
  )

  // Handle /compact command: replace message history with the summary
  const wasCompacted =
    prompt &&
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
    toolCalls.filter(
      (call) => !TOOLS_WHICH_WONT_FORCE_NEXT_STEP.includes(call.toolName),
    ).length === 0 &&
    toolResults.filter(
      (result) => !TOOLS_WHICH_WONT_FORCE_NEXT_STEP.includes(result.toolName),
    ).length === 0 &&
    !hadToolCallError // Tool call errors should also force another step so the agent can retry

  const hasTaskCompleted = toolCalls.some(
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

  agentState = {
    ...agentState,
    stepsRemaining: agentState.stepsRemaining - 1,
    agentContext,
  }

  // Capture the assistant response and tool results added during this step
  params.traceWriter?.recordStep({
    agentId: agentState.agentId,
    agentType: String(agentType),
    runId: agentState.runId,
    userInputId,
    step: iterationNum,
    system,
    messages: agentState.messageHistory,
  })

  logger.debug(
    {
      iteration: iterationNum,
      agentId: agentState.agentId,
      model,
      prompt,
      shouldEndTurn,
      duration: Date.now() - startTime,
      // FID-2026-0815-012 G-01: summarize only. `fullResponse`, `toolCalls`,
      // and `toolResults` are captured by the trace writer (via
      // messageHistory above) and the persisted chat file, so re-serializing
      // them here deep-copies large payloads every step for no observability
      // gain. Keep the cheap scalar summary fields instead.
      messageCount: agentState.messageHistory.length,
      stepCreditsUsed,
    },
    `End agent ${agentType} step ${iterationNum} (${userInputId}${prompt ? ` - Prompt: ${prompt.slice(0, 20)}` : ''})`,
  )

  return {
    agentState,
    fullResponse,
    shouldEndTurn,
    hasNativeIncompleteToolCall,
    messageId,
    nResponses: undefined,
  }
}

export type RunAgentStepFn = typeof runAgentStep

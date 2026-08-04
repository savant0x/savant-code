import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'
import { shouldUseLocalTokenCount } from '@savant-code/common/constants/free-agents'
import {
  supportsAssistantPrefill,
  supportsCacheControl,
} from '@savant-code/common/old-constants'
import { TOOLS_WHICH_WONT_FORCE_NEXT_STEP } from '@savant-code/common/tools/constants'
import { buildArray } from '@savant-code/common/util/array'
import { serializeCacheDebugCorrelation } from '@savant-code/common/util/cache-debug'
import {
  AbortError,
  FETCH_IDLE_TIMEOUT_USER_MESSAGE,
  TRANSIENT_NETWORK_ERROR_USER_MESSAGE,
  extractApiErrorDetails,
  getErrorObject,
  isAbortError,
  isFetchIdleTimeoutError,
  isTransientNetworkError,
} from '@savant-code/common/util/error'
import { systemMessage, userMessage } from '@savant-code/common/util/messages'
import { toToolInputJSONSchema } from '@savant-code/common/util/zod-schema'
import { type ToolSet } from 'ai'
import { cloneDeep, mapValues } from 'lodash'

import { CACHE_DEBUG_FULL_LOGGING } from './constants'
import { ContextCompactor } from './context-compactor'
import { callTokenCountAPI } from './llm-api/savant-code-web-api'
import { getMCPToolData } from './mcp'
import { getAgentStreamFromTemplate } from './prompt-agent-stream'
import {
  clearProgrammaticRunState,
  runProgrammaticStep,
} from './run-programmatic-step'
import { additionalSystemPrompts } from './system-prompt/prompts'
import { getAgentTemplate } from './templates/agent-registry'
import { buildAgentToolSet } from './templates/prompts'
import { getAgentPrompt } from './templates/strings'
import { filterToolSet } from './tools/filter-tool-set'
import { getToolSet } from './tools/prompts'
import { processStream } from './tools/stream-parser'
import {
  resetThinkerConvergenceState,
  runThinkerConvergenceGate,
} from './tools/thinker-convergence-gate'
import { cleanupThoughtSession } from './tools/thought-session-store'
import { setActivity } from './util/activity-tracking'
import { getAgentOutput } from './util/agent-output'
import {
  createCacheDebugSnapshot,
  enrichCacheDebugSnapshotWithProviderRequest,
  enrichCacheDebugSnapshotWithUsage,
} from './util/cache-debug'
import {
  withSystemInstructionTags,
  withSystemTags as withSystemTags,
  buildUserMessageContent,
  expireMessages,
} from './util/messages'
import { isThinkOnlyResponse } from './util/think-tags'
import {
  countTokens,
  countTokensJson,
  countTokensMessagesCached,
} from './util/token-counter'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { TrackEventFn } from '@savant-code/common/types/contracts/analytics'
import type {
  AddAgentStepFn,
  FinishAgentRunFn,
  StartAgentRunFn,
} from '@savant-code/common/types/contracts/database'
import type {
  CacheDebugUsageData,
  PromptAiSdkFn,
} from '@savant-code/common/types/contracts/llm'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { TraceWriter } from '@savant-code/common/types/contracts/trace'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type { JSONValue } from '@savant-code/common/types/json'
import type {
  TextPart,
  ImagePart,
} from '@savant-code/common/types/messages/content-part'
import type {
  Message,
  ToolMessage,
} from '@savant-code/common/types/messages/savant-code-message'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type {
  AgentTemplateType,
  AgentState,
  AgentOutput,
} from '@savant-code/common/types/session-state'
import type {
  CustomToolDefinitions,
  ProjectFileContext,
} from '@savant-code/common/util/file'
import type z from 'zod/v4'

// Convert a tool's stored inputSchema into JSON Schema suitable for Anthropic's
// count_tokens API. Built-in and MCP tools store a Zod schema here; serializing
// it raw ships Zod internals (`def`/`shape`) instead of JSON Schema, so token
// counts are computed against garbage and any schema whose top-level isn't an
// object (e.g. a union → `anyOf`) arrives without `type`, which the API rejects
// with `tools.N.custom.input_schema.type: Field required`. We convert to JSON
// Schema and guarantee a top-level `type: 'object'`.
export function toTokenCountInputSchema(
  inputSchema: JSONValue,
): Record<string, JSONValue> | undefined {
  if (inputSchema == null) return undefined

  let jsonSchema: Record<string, JSONValue>
  if (
    typeof (inputSchema as { safeParse?: unknown }).safeParse === 'function'
  ) {
    try {
      jsonSchema = toToolInputJSONSchema(
        inputSchema as unknown as z.ZodType,
      ) as Record<string, JSONValue>
    } catch {
      jsonSchema = { type: 'object', properties: {} }
    }
  } else if (typeof inputSchema === 'object' && !Array.isArray(inputSchema)) {
    // Already a plain object (e.g. a pre-serialized JSON Schema) — copy it.
    jsonSchema = { ...(inputSchema as Record<string, JSONValue>) }
  } else {
    return undefined
  }

  // `$schema` is meaningless to count_tokens; drop it to keep the payload lean.
  delete jsonSchema['$schema']
  // Anthropic requires a top-level `type: 'object'`. Object schemas already
  // carry it; union/intersection schemas (anyOf/allOf) don't — backfill it.
  // Treat missing / null / empty-string as absent (valid JSON Schema `type` is
  // always a non-empty string or array).
  if (jsonSchema.type == null || jsonSchema.type === '') {
    jsonSchema.type = 'object'
  }
  return jsonSchema
}

async function additionalToolDefinitions(
  params: {
    agentTemplate: AgentTemplate
    fileContext: ProjectFileContext
  } & ParamsExcluding<
    typeof getMCPToolData,
    'toolNames' | 'mcpServers' | 'writeTo'
  >,
): Promise<CustomToolDefinitions> {
  const { agentTemplate, fileContext } = params

  const defs = cloneDeep(
    Object.fromEntries(
      Object.entries(fileContext.customToolDefinitions).filter(([toolName]) =>
        agentTemplate.toolNames.includes(toolName),
      ),
    ),
  )
  return getMCPToolData({
    ...params,
    toolNames: agentTemplate.toolNames,
    mcpServers: agentTemplate.mcpServers,
    writeTo: defs,
  })
}

export const runAgentStep = async (
  params: {
    userId: string | undefined
    userInputId: string
    clientSessionId: string
    fingerprintId: string
    repoId: string | undefined
    onResponseChunk: (chunk: string | PrintModeEvent) => void

    agentType: AgentTemplateType
    agentTemplate: AgentTemplate
    fileContext: ProjectFileContext
    agentState: AgentState
    localAgentTemplates: Record<string, AgentTemplate>

    prompt: string | undefined
    spawnParams: Record<string, JSONValue> | undefined
    system: string
    n?: number
    /** FID-2026-0802-005 L15: step prompt computed once per step by
     *  loopAgentSteps (token counting needs it too) and passed down — avoids
     *  a second formatPrompt pass (~13 replaceAll incl. file tree). */
    stepPrompt?: string
    /** FID-2026-0802-005 H8: step-built custom tool data (incl. MCP tools). */
    customToolDefinitions?: CustomToolDefinitions

    trackEvent: TrackEventFn
    promptAiSdk: PromptAiSdkFn
    traceWriter?: TraceWriter
  } & ParamsExcluding<
    typeof processStream,
    | 'agentContext'
    | 'agentState'
    | 'agentStepId'
    | 'agentTemplate'
    | 'fullResponse'
    | 'messages'
    | 'onCostCalculated'
    | 'repoId'
    | 'stream'
  > &
    ParamsExcluding<
      typeof getAgentStreamFromTemplate,
      | 'agentId'
      | 'includeCacheControl'
      | 'messages'
      | 'onCostCalculated'
      | 'template'
    > &
    ParamsExcluding<typeof getAgentTemplate, 'agentId'> &
    ParamsExcluding<
      typeof getAgentPrompt,
      'agentTemplate' | 'promptType' | 'agentState' | 'agentTemplates'
    > &
    ParamsExcluding<
      typeof getMCPToolData,
      'toolNames' | 'mcpServers' | 'writeTo'
    > &
    ParamsExcluding<
      PromptAiSdkFn,
      'messages' | 'model' | 'onCostCalculated' | 'n'
    >,
): Promise<{
  agentState: AgentState
  fullResponse: string
  shouldEndTurn: boolean
  hasNativeIncompleteToolCall: boolean
  messageId: string | null
  nResponses?: string[]
}> => {
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
    promptAiSdk,
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

  const agentMessagesUntruncated = buildArray<Message>(
    ...expireMessages(agentState.messageHistory, 'agentStep'),

    stepPrompt &&
      userMessage({
        content: stepPrompt,
        tags: ['STEP_PROMPT'],

        // James: Deprecate the below, only use tags, which are not prescriptive.
        timeToLive: 'agentStep' as const,
        keepDuringTruncation: true,
      }),
  )

  agentState.messageHistory = agentMessagesUntruncated

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
  // it (which would add quotes and escape every newline).
  const systemTokens = countTokens(system)

  let cacheDebugCorrelation:
    ReturnType<typeof createCacheDebugSnapshot> | undefined
  if (CACHE_DEBUG_FULL_LOGGING) {
    try {
      cacheDebugCorrelation = createCacheDebugSnapshot({
        agentType: String(agentType),
        system,
        toolDefinitions: (params.tools
          ? Object.fromEntries(
              Object.entries(params.tools).map(([name, tool]) => [
                name,
                {
                  description: tool.description,
                  inputSchema: tool.inputSchema as unknown as Record<
                    string,
                    JSONValue
                  >,
                },
              ]),
            )
          : {}) as Record<string, JSONValue>,
        messages: [systemMessage(system), ...agentState.messageHistory],
        logger,
        projectRoot: fileContext.projectRoot,
        runId: agentState.runId,
        userInputId,
        agentStepId,
        model,
      })
    } catch (err) {
      logger.warn({ error: err }, '[Cache Debug] Failed to create snapshot')
    }
  }

  const onCacheDebugProviderRequestBuilt = cacheDebugCorrelation
    ? ({
        provider,
        rawBody,
        normalizedBody,
      }: {
        provider: string
        rawBody: JSONValue
        normalizedBody?: JSONValue
      }) => {
        enrichCacheDebugSnapshotWithProviderRequest({
          correlation: cacheDebugCorrelation,
          provider,
          rawBody,
          normalized: normalizedBody ?? rawBody,
          logger,
        })
      }
    : undefined

  const onCacheDebugUsageReceived = cacheDebugCorrelation
    ? (usage: CacheDebugUsageData) => {
        enrichCacheDebugSnapshotWithUsage({
          correlation: cacheDebugCorrelation,
          usage,
          logger,
        })
      }
    : undefined

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
    const result = await promptAiSdk({
      ...params,
      messages: agentState.messageHistory,
      model,
      n: params.n,
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
        if (params.n > 1) {
          throw new Error(
            `Expected JSON array response from LLM when n > 1, got non-array: ${responsesString.slice(0, 50)}`,
          )
        }
        // If it parsed but isn't an array, treat as single response
        nResponses = [responsesString]
      }
    } catch (e) {
      if (params.n > 1) {
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

  // FID-2026-0725-083: Goal evaluation — if a goal condition is set and the
  // agent called task_completed, check whether the goal is satisfied.
  // If satisfied → keep shouldEndTurn = true (end the loop).
  // If not satisfied → set shouldEndTurn = false (continue iterating).
  if (shouldEndTurn && agentState.goalCondition) {
    const goalSatisfied = /\bGOAL_SATISFIED\b/.test(fullResponse)
    if (goalSatisfied) {
      logger.info(
        { goalCondition: agentState.goalCondition },
        'Goal evaluation: GOAL_SATISFIED — ending loop',
      )
    } else {
      // Goal not satisfied or error — continue iterating
      shouldEndTurn = false
      const goalNotSatisfied = /\bGOAL_NOT_SATISFIED\b/.test(fullResponse)
      const goalError = /\bGOAL_ERROR\b/.test(fullResponse)
      const reason = goalNotSatisfied
        ? 'NOT_SATISFIED'
        : goalError
          ? 'ERROR'
          : 'no marker found'
      logger.debug(
        { goalCondition: agentState.goalCondition, reason },
        `Goal evaluation: ${reason} — continuing iteration`,
      )
    }
  }

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
      fullResponse,
      // Summarize instead of logging the full message history: logging it
      // every step bloats log files quadratically over the course of a chat.
      messageCount: agentState.messageHistory.length,
      toolCalls,
      toolResults,
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

/**
 * Runs the agent loop.
 *
 * IMPORTANT: This function mutates `params.agentState` in place throughout the
 * run (not just at return time). Fields like `messageHistory`, `systemPrompt`,
 * `toolDefinitions`, `creditsUsed`, and `output` are updated as work progresses
 * so that callers holding a reference to the same object (e.g. the SDK's
 * `sessionState.mainAgentState`) see in-progress work immediately — which
 * matters when an error is thrown mid-run and the normal return path is
 * skipped.
 */
export async function loopAgentSteps(
  params: {
    addAgentStep: AddAgentStepFn
    agentState: AgentState
    agentType: string
    clearUserPromptMessagesAfterResponse?: boolean
    clientSessionId: string
    content?: Array<TextPart | ImagePart>
    fileContext: ProjectFileContext
    finishAgentRun: FinishAgentRunFn
    localAgentTemplates: Record<string, AgentTemplate>
    logger: Logger
    parentSystemPrompt?: string
    parentTools?: ToolSet
    prompt: string | undefined
    signal: AbortSignal
    /** Optional steering hook. Drained at each step boundary (after a step's LLM
     * call + tools complete, before the next one). Any returned texts are appended
     * to the message history as user prompts and keep the turn going, letting a
     * host "steer" a running agent without aborting or losing the current step. */
    drainSteeringMessages?: () => string[]
    spawnParams: Record<string, JSONValue> | undefined
    startAgentRun: StartAgentRunFn
    userId: string | undefined
    userInputId: string
    agentTemplate?: AgentTemplate
    /** FID-2026-0725-085 CTX-007: Resolved context window from OpenRouter catalog. */
    contextWindow?: number
  } & ParamsExcluding<typeof additionalToolDefinitions, 'agentTemplate'> &
    ParamsExcluding<
      typeof runProgrammaticStep,
      | 'agentState'
      | 'onCostCalculated'
      | 'prompt'
      | 'runId'
      | 'stepNumber'
      | 'stepsComplete'
      | 'system'
      | 'template'
      | 'toolCallParams'
      | 'tools'
    > &
    ParamsExcluding<typeof getAgentTemplate, 'agentId'> &
    ParamsExcluding<
      typeof getAgentPrompt,
      | 'agentTemplate'
      | 'promptType'
      | 'agentTemplates'
      | 'additionalToolDefinitions'
    > &
    ParamsExcluding<
      typeof getMCPToolData,
      'toolNames' | 'mcpServers' | 'writeTo'
    > &
    ParamsExcluding<StartAgentRunFn, 'agentId' | 'ancestorRunIds'> &
    ParamsExcluding<
      FinishAgentRunFn,
      'runId' | 'status' | 'totalSteps' | 'directCredits' | 'totalCredits'
    > &
    ParamsExcluding<
      typeof runAgentStep,
      | 'additionalToolDefinitions'
      | 'agentState'
      | 'agentTemplate'
      | 'prompt'
      | 'runId'
      | 'spawnParams'
      | 'system'
      | 'tools'
    > &
    ParamsExcluding<
      AddAgentStepFn,
      | 'agentRunId'
      | 'stepNumber'
      | 'credits'
      | 'childRunIds'
      | 'messageId'
      | 'status'
      | 'startTime'
    >,
): Promise<{
  agentState: AgentState
  output: AgentOutput
}> {
  const {
    addAgentStep,
    agentState: initialAgentState,
    agentType,
    clearUserPromptMessagesAfterResponse = true,
    content,
    fileContext,
    finishAgentRun,
    localAgentTemplates,
    logger,
    parentSystemPrompt,
    parentTools,
    prompt,
    signal,
    spawnParams,
    startAgentRun,
    clientEnv,
    ciEnv,
  } = params

  let agentTemplate = params.agentTemplate
  if (!agentTemplate) {
    agentTemplate =
      (await getAgentTemplate({
        ...params,
        agentId: agentType,
      })) ?? undefined
  }
  if (!agentTemplate) {
    throw new Error(`Agent template not found for type: ${agentType}`)
  }

  if (signal.aborted) {
    return {
      agentState: initialAgentState,
      output: {
        type: 'error',
        message: 'Run cancelled by user',
      },
    }
  }

  const runId = await startAgentRun({
    ...params,
    agentId: agentTemplate.id,
    ancestorRunIds: initialAgentState.ancestorRunIds,
  })
  if (!runId) {
    throw new Error('Failed to start agent run')
  }
  initialAgentState.runId = runId

  let cachedAdditionalToolDefinitions: CustomToolDefinitions | undefined
  // Use parent's tools for prompt caching when inheritParentSystemPrompt is true
  const useParentTools =
    agentTemplate.inheritParentSystemPrompt && parentTools !== undefined
  const inheritedParentTools: ToolSet = parentTools ?? {}

  // Initialize message history with user prompt and instructions on first iteration
  const instructionsPrompt = await getAgentPrompt({
    ...params,
    agentTemplate,
    promptType: { type: 'instructionsPrompt' },
    agentTemplates: localAgentTemplates,
    useParentTools,
    additionalToolDefinitions: async () => {
      if (!cachedAdditionalToolDefinitions) {
        cachedAdditionalToolDefinitions = await additionalToolDefinitions({
          ...params,
          agentTemplate,
        })
      }
      return cachedAdditionalToolDefinitions
    },
  })

  // Build the initial message history with user prompt and instructions
  // Generate system prompt once, using parent's if inheritParentSystemPrompt is true
  let system: string
  if (agentTemplate.inheritParentSystemPrompt && parentSystemPrompt) {
    system = parentSystemPrompt
  } else {
    const systemPrompt = await getAgentPrompt({
      ...params,
      agentTemplate,
      promptType: { type: 'systemPrompt' },
      agentTemplates: localAgentTemplates,
      additionalToolDefinitions: async () => {
        if (!cachedAdditionalToolDefinitions) {
          cachedAdditionalToolDefinitions = await additionalToolDefinitions({
            ...params,
            agentTemplate,
          })
        }
        return cachedAdditionalToolDefinitions
      },
    })
    system = systemPrompt ?? ''
  }

  // Prompt inheritance and capability inheritance are separate concerns. A
  // child may reuse the parent's system prompt while still needing its own
  // tool definitions when the parent does not contain every allowed tool.
  const parentToolKeys = new Set(Object.keys(inheritedParentTools))
  const childToolsSubsetOfParent = agentTemplate.toolNames.every((toolName) =>
    parentToolKeys.has(toolName),
  )
  const useInheritedTools = useParentTools && childToolsSubsetOfParent

  // Build agent tools (agents as direct tool calls) whenever the child needs
  // its own tool construction. This preserves spawnable child-agent tools in
  // the same fallback path as built-in, custom, MCP, and skill tools.
  const agentTools = useInheritedTools
    ? {}
    : await buildAgentToolSet({
        ...params,
        spawnableAgents: agentTemplate.spawnableAgents,
        agentTemplates: localAgentTemplates,
      })

  const tools = useInheritedTools
    ? filterToolSet(inheritedParentTools, agentTemplate.toolNames)
    : await getToolSet({
        toolNames: agentTemplate.toolNames,
        additionalToolDefinitions: async () => {
          if (!cachedAdditionalToolDefinitions) {
            cachedAdditionalToolDefinitions = await additionalToolDefinitions({
              ...params,
              agentTemplate,
            })
          }
          return cachedAdditionalToolDefinitions
        },
        agentTools,
        skills: fileContext.skills ?? {},
      })

  const hasUserMessage = Boolean(
    prompt ||
    (spawnParams && Object.keys(spawnParams).length > 0) ||
    (content && content.length > 0),
  )

  const initialMessages = buildArray<Message>(
    ...initialAgentState.messageHistory,

    hasUserMessage && [
      {
        // Actual user message!
        role: 'user' as const,
        content: buildUserMessageContent(prompt, spawnParams, content),
        tags: ['USER_PROMPT'],
        sentAt: Date.now(),

        // James: Deprecate the below, only use tags, which are not prescriptive.
        keepDuringTruncation: true,
      },
      prompt &&
        prompt in additionalSystemPrompts &&
        userMessage(
          withSystemInstructionTags(
            additionalSystemPrompts[
              prompt as keyof typeof additionalSystemPrompts
            ],
          ),
        ),
    ],

    instructionsPrompt &&
      userMessage({
        content: instructionsPrompt,
        tags: ['INSTRUCTIONS_PROMPT'],

        // James: Deprecate the below, only use tags, which are not prescriptive.
        keepLastTags: ['INSTRUCTIONS_PROMPT'],
      }),
  )

  // Convert tools to a serializable format for context-pruner token counting.
  // FID-2026-0802-005 L9: the inputSchema slot is typed as JSONValue (it feeds
  // toTokenCountInputSchema, which handles Zod + JSON Schema + garbage); the
  // AI SDK JSONSchema → JSONValue conversion is an honest trust-boundary
  // assertion (tracked in the FID-029 ledger), not a cast-to-nothing.
  const toolDefinitions: Record<
    string,
    { description: string | undefined; inputSchema: JSONValue }
  > = mapValues(tools, (tool) => ({
    description: tool.description,
    inputSchema: tool.inputSchema as unknown as JSONValue,
  }))

  const additionalToolDefinitionsWithCache = async () => {
    if (!cachedAdditionalToolDefinitions) {
      cachedAdditionalToolDefinitions = await additionalToolDefinitions({
        ...params,
        agentTemplate,
      })
    }
    return cachedAdditionalToolDefinitions
  }

  // Mutate initialAgentState so that in-progress work propagates back to the
  // caller's shared reference (e.g. SDK's sessionState.mainAgentState) even if
  // an error is thrown before we return.
  initialAgentState.messageHistory = initialMessages
  initialAgentState.systemPrompt = system
  initialAgentState.toolDefinitions = toolDefinitions
  let currentAgentState: AgentState = initialAgentState

  // Convert tool definitions to Anthropic format for accurate token counting.
  // Tool definitions are stored as { [name]: { description, inputSchema } },
  // where inputSchema is a Zod schema. Anthropic's count_tokens API expects
  // [{ name, description, input_schema }] with input_schema being real JSON
  // Schema (with a top-level `type: 'object'`) — see toTokenCountInputSchema.
  const toolsForTokenCount = Object.entries(toolDefinitions).map(
    ([name, def]) => {
      const input_schema = toTokenCountInputSchema(def.inputSchema)
      return {
        name,
        ...(def.description && { description: def.description }),
        ...(input_schema && { input_schema }),
      }
    },
  )

  let shouldEndTurn = false
  let hasRetriedOutputSchema = false
  let currentPrompt = prompt
  let currentParams = spawnParams
  let totalSteps = 0
  let nResponses: string[] | undefined = undefined
  let consecutiveNativeIncompleteSteps = 0

  // FID-2026-0725-083: Parse goal condition from the initial message.
  // The /goal command sends <goal condition="..."> in the message content.
  // We extract it and store it in agentState.goalCondition for evaluation
  // after each task_completed call.
  if (hasUserMessage && prompt) {
    const goalMatch = prompt.match(/<goal condition="([^"]+)">/)
    if (goalMatch && !currentAgentState.goalCondition) {
      currentAgentState.goalCondition = goalMatch[1]
      logger.info(
        { goalCondition: goalMatch[1] },
        'Goal condition detected from message — will evaluate after each task_completed',
      )
    }
  }

  // FID-2026-0725-085: Initialize ContextCompactor for micro-compact before each API call.
  // This runs at the start of the agent loop so it's available for every iteration.
  // Use resolved contextWindow from CLI (CTX-007) or infer from model name (CTX-003).
  const contextCompactor = new ContextCompactor({
    logger,
    contextWindow: params.contextWindow,
    model: agentTemplate.model,
  })
  // FID-2026-0725-085 Layer 3: Wire resolved context window into agentState
  // so handleSteps (savant.ts) can use it for auto-compact threshold.
  initialAgentState.maxContextLength =
    contextCompactor.getThresholds().autoCompact + 30_000

  try {
    while (true) {
      totalSteps++
      if (signal.aborted) {
        throw new AbortError()
      }

      const startTime = new Date()

      // FID-2026-0802-005 L15: computed once per step and reused by
      // runAgentStep. Note: this runs before the programmatic step, so a
      // handleSteps generator that mutates history (e.g. set_messages) could
      // in theory make the USER_INPUT_PROMPT placeholder stale — no bundled
      // agent does this; acceptable per the FID.
      const stepPrompt = await getAgentPrompt({
        ...params,
        agentTemplate,
        promptType: { type: 'stepPrompt' },
        fileContext,
        agentState: currentAgentState,
        agentTemplates: localAgentTemplates,
        logger,
        additionalToolDefinitions: additionalToolDefinitionsWithCache,
      })
      const messagesWithStepPrompt = buildArray(
        ...currentAgentState.messageHistory,
        stepPrompt &&
          userMessage({
            content: stepPrompt,
          }),
      )

      // Count structured message content (not JSON.stringify, which inflates the
      // count and counts image base64 as text); system is a plain string; tool
      // schemas stay JSON since that's roughly how the model sees them.
      // FID-2026-0802-005 H2: countTokensMessagesCached memoizes per-message
      // counts by object identity, so the history is tokenized once over the
      // whole run instead of re-encoded every step (O(n²) → O(n)). The step
      // prompt is counted directly instead of rebuilding the array (saves the
      // per-step copy too).
      const estimateContextTokensLocally = () =>
        countTokensMessagesCached(currentAgentState.messageHistory) +
        countTokens(stepPrompt ?? '') +
        countTokens(system) +
        countTokensJson(toolsForTokenCount)

      // Use local token estimation for external runs (OpenCode Go, BYOK,
      // savant-free) where the SavantCode web API is unavailable or unnecessary.
      // The external API ships the full message history + tools via HTTP on every
      // step, adding serial network overhead (30s timeout × 3 retries). Local
      // estimation uses gpt-tokenizer with a 1.35× fudge factor — fast and
      // accurate enough for context management. Only SavantCode-hosted paid runs
      // need the accurate API count for credit billing.
      const hasSavantCodeBackend = Boolean(
        params.apiKey ?? ciEnv.SAVANT_CODE_API_KEY,
      )
      if (
        shouldUseLocalTokenCount({
          agentId: agentTemplate.id,
          model: agentTemplate.model,
          hasSavantCodeBackend,
        })
      ) {
        currentAgentState.contextTokenCount = estimateContextTokensLocally()
      } else {
        // SavantCode-hosted paid run: use the accurate web API count.
        const tokenCountResult = await callTokenCountAPI({
          messages: messagesWithStepPrompt as JSONValue[],
          system,
          model: agentTemplate.model,
          tools: toolsForTokenCount as Array<{
            name: string
            description?: string
            input_schema?: JSONValue
          }>,
          fetch,
          logger,
          env: { clientEnv, ciEnv },
          apiKey: params.apiKey,
        })
        if (tokenCountResult.inputTokens !== undefined) {
          currentAgentState.contextTokenCount = tokenCountResult.inputTokens
        } else if (tokenCountResult.error) {
          logger.warn(
            { error: tokenCountResult.error },
            'Failed to get token count from web API — falling back to local estimation',
          )
          currentAgentState.contextTokenCount = estimateContextTokensLocally()
        }
      }

      // FID-2026-0725-085: Run micro-compact before each API call to clear stale tool results.
      // This is zero-cost (no LLM call) and reduces context size incrementally.
      const thresholds = contextCompactor.getThresholds()
      const messagesBeforeMicroCompact = currentAgentState.messageHistory.length
      const microResult = contextCompactor.microCompact(
        currentAgentState.messageHistory,
      )
      if (microResult.tokensSaved > 0) {
        // FID-2026-0802-005 L8: ContextCompactor now operates on Message[]
        // directly — the `as unknown as CompactionMessage[]` casts are gone.
        currentAgentState.messageHistory = microResult.messages
        // FID-2026-0725-085: Log visible compaction summary.
        // Follows the Kilo Code / OpenClaude pattern: pause, output summary, proceed.
        const percentUsed = Math.round(
          (currentAgentState.contextTokenCount / thresholds.autoCompact) * 100,
        )
        logger.info(
          {
            messagesCleared:
              messagesBeforeMicroCompact - microResult.messages.length,
            tokensSaved: microResult.tokensSaved,
            percentUsed,
          },
          `⚙️ Context micro-compacted: cleared stale tool results, ~${microResult.tokensSaved.toLocaleString()} tokens saved. Context at ${percentUsed}% of auto-compact threshold.`,
        )
      }

      // FID-2026-0725-085: Check auto-compact threshold.
      // If context exceeds threshold, emit warning and log for diagnostics.
      // Full LLM summarization is handled by handleSteps context-pruner spawn.
      const autoCompactCheck = contextCompactor.shouldAutoCompact(
        currentAgentState.messageHistory,
        currentAgentState.contextTokenCount,
      )
      if (autoCompactCheck.shouldCompact) {
        const degradationWarning = contextCompactor.getDegradationWarning()
        if (degradationWarning) {
          logger.warn(
            { contextTokenCount: currentAgentState.contextTokenCount },
            degradationWarning,
          )
        } else {
          logger.warn(
            {
              contextTokenCount: currentAgentState.contextTokenCount,
              threshold: thresholds.autoCompact,
            },
            `⚠️ Context approaching auto-compact threshold (${currentAgentState.contextTokenCount.toLocaleString()} / ${thresholds.autoCompact.toLocaleString()} tokens). Full summarization will trigger via context-pruner.`,
          )
        }
      }

      // FID-2026-0725-085 Layer 3: After step completes, check if context was compacted
      // and record result in ContextCompactor for circuit breaker tracking.
      // Detect compaction by checking if contextTokenCount dropped significantly.

      // 1. Run programmatic step first if it exists
      let n: number | undefined = undefined

      if (agentTemplate.handleSteps) {
        const programmaticResult = await runProgrammaticStep({
          ...params,

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
            agentType,
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
      if (shouldEndTurn) {
        break
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
        ...params,

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
        customToolDefinitions: cachedAdditionalToolDefinitions,
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
        // “Consecutive” means no intervening normal text, valid tool result, or
        // unrelated tool error. Any non-native-incomplete step breaks recovery
        // streaks before the normal turn decision is applied.
        consecutiveNativeIncompleteSteps = 0
        shouldEndTurn = llmShouldEndTurn
      }

      // FID-2026-0801-012: Thinker convergence gate.
      // Runs at the runtime boundary AFTER the native step's tool results are
      // committed to history, and BEFORE the loop-top `output === undefined &&
      // shouldEndTurn` restart check. For the Thinker it builds the
      // FinalArtifact from the session snapshot and sets `agentState.output`
      // for every terminal status — otherwise the restart branch would fire
      // the "You must use set_output" message and reintroduce
      // `structuredOutput: null` (set_output is not in the Thinker's
      // toolNames). Retries keep the loop going with a typed message.
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
        await addAgentStep({
          ...params,
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
      const steered = params.drainSteeringMessages?.()
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
    }

    if (clearUserPromptMessagesAfterResponse) {
      currentAgentState.messageHistory = expireMessages(
        currentAgentState.messageHistory,
        'userPrompt',
      )
    }

    await finishAgentRun({
      ...params,
      runId,
      status: 'completed',
      totalSteps,
      directCredits: currentAgentState.directCreditsUsed,
      totalCredits: currentAgentState.creditsUsed,
    })

    return {
      agentState: currentAgentState,
      output: getAgentOutput(currentAgentState, agentTemplate),
    }
  } catch (error) {
    // Handle user-initiated aborts separately - don't log as errors
    if (isAbortError(error)) {
      if (clearUserPromptMessagesAfterResponse) {
        currentAgentState.messageHistory = expireMessages(
          currentAgentState.messageHistory,
          'userPrompt',
        )
      }

      currentAgentState.messageHistory = [
        ...currentAgentState.messageHistory,
        userMessage(
          withSystemTags(
            "User interrupted the response. The assistant's previous work has been preserved.",
          ),
        ),
      ]

      logger.info(
        {
          agentType,
          agentId: currentAgentState.agentId,
          runId,
          totalSteps,
          messageHistory: currentAgentState.messageHistory,
        },
        'Agent run cancelled by user (abort error)',
      )

      await finishAgentRun({
        ...params,
        runId,
        status: 'cancelled',
        totalSteps,
        directCredits: currentAgentState.directCreditsUsed,
        totalCredits: currentAgentState.creditsUsed,
      })

      return {
        agentState: currentAgentState,
        output: {
          type: 'error',
          message: 'Run cancelled by user',
        },
      }
    }

    // FID-2026-0725-085 Layer 4: Reactive compact — catch prompt-too-long errors,
    // aggressively truncate, and retry once before surfacing the error.
    if (ContextCompactor.isPromptTooLongError(error) && !signal.aborted) {
      logger.warn(
        { error: getErrorObject(error) },
        'Layer 4 reactive compact: prompt-too-long detected, attempting emergency truncation',
      )
      const reactiveResult = contextCompactor.reactiveCompact(
        currentAgentState.messageHistory,
      )
      if (reactiveResult.truncated) {
        currentAgentState.messageHistory = reactiveResult.messages
        logger.warn(
          {
            messagesRemoved:
              currentAgentState.messageHistory.length -
              reactiveResult.messages.length,
            tokensSaved: reactiveResult.tokensSaved,
          },
          `Layer 4 reactive compact: truncated ${currentAgentState.messageHistory.length - reactiveResult.messages.length} messages, saved ~${reactiveResult.tokensSaved.toLocaleString()} tokens. Retrying API call once.`,
        )
        // Retry the API call once after reactive compaction
        try {
          const retryResult = await runAgentStep({
            ...params,
            agentState: currentAgentState,
            agentTemplate,
            n: undefined,
            prompt: currentPrompt,
            runId,
            spawnParams: currentParams,
            system,
            tools,
            additionalToolDefinitions: additionalToolDefinitionsWithCache,
            customToolDefinitions: cachedAdditionalToolDefinitions,
          })
          // Retry succeeded — use the result
          Object.assign(initialAgentState, retryResult.agentState)
          currentAgentState = initialAgentState
          contextCompactor.recordCompactionResult(
            true,
            currentAgentState.contextTokenCount,
          )
          await finishAgentRun({
            ...params,
            runId,
            status: 'completed',
            totalSteps,
            directCredits: currentAgentState.directCreditsUsed,
            totalCredits: currentAgentState.creditsUsed,
          })
          return {
            agentState: currentAgentState,
            output: getAgentOutput(currentAgentState, agentTemplate),
          }
        } catch (retryError) {
          // Retry also failed — log and fall through to standard error handling
          contextCompactor.recordCompactionResult(false)
          logger.error(
            { retryError: getErrorObject(retryError) },
            'Layer 4 reactive compact: retry also failed',
          )
        }
      }
    }

    logger.error(
      {
        error: getErrorObject(error),
        agentType,
        agentId: currentAgentState.agentId,
        runId,
        totalSteps,
        directCreditsUsed: currentAgentState.directCreditsUsed,
        creditsUsed: currentAgentState.creditsUsed,
        messageHistory: currentAgentState.messageHistory,
        systemPrompt: system,
      },
      'Agent execution failed',
    )

    const apiErrorDetails = extractApiErrorDetails(error)
    const isIdleTimeout = isFetchIdleTimeoutError(error)
    const isNetworkError = !isIdleTimeout && isTransientNetworkError(error)
    const hasServerMessage = apiErrorDetails.message !== undefined
    let fallbackMessage: string
    if (isIdleTimeout) {
      fallbackMessage = FETCH_IDLE_TIMEOUT_USER_MESSAGE
    } else if (isNetworkError) {
      fallbackMessage = TRANSIENT_NETWORK_ERROR_USER_MESSAGE
    } else if (error instanceof Error) {
      const includeStack =
        apiErrorDetails.statusCode === undefined && error.stack
      fallbackMessage =
        error.message + (includeStack ? `\n\n${error.stack}` : '')
    } else {
      fallbackMessage = String(error)
    }
    const errorMessage = apiErrorDetails.message ?? fallbackMessage
    const statusCode = apiErrorDetails.statusCode

    const status = signal.aborted ? 'cancelled' : 'failed'
    await finishAgentRun({
      ...params,
      runId,
      status,
      totalSteps,
      directCredits: currentAgentState.directCreditsUsed,
      totalCredits: currentAgentState.creditsUsed,
      errorMessage,
    })

    // Payment required errors (402) should propagate
    if (statusCode === 402) {
      throw error
    }

    return {
      agentState: currentAgentState,
      output: {
        type: 'error',
        message:
          hasServerMessage || isIdleTimeout || isNetworkError
            ? errorMessage
            : 'Agent run error: ' + errorMessage,
        ...(statusCode !== undefined && { statusCode }),
        ...(apiErrorDetails.errorCode !== undefined && {
          error: apiErrorDetails.errorCode,
        }),
        ...(apiErrorDetails.countryCode !== undefined && {
          countryCode: apiErrorDetails.countryCode,
        }),
        ...(apiErrorDetails.countryBlockReason !== undefined && {
          countryBlockReason: apiErrorDetails.countryBlockReason,
        }),
        ...(apiErrorDetails.ipPrivacySignals !== undefined && {
          ipPrivacySignals: apiErrorDetails.ipPrivacySignals,
        }),
      },
    }
  } finally {
    // The endTurn path inside runProgrammaticStep handles normal completion,
    // but abort/error exits (e.g. chat SSE disconnects) would otherwise leak
    // the run's generator, STEP_ALL flag, and proposed file content forever.
    clearProgrammaticRunState(runId)
    // FID-2026-0801-012: per-run ThoughtSession and retry counters must not
    // leak across abort/error exits; cleanup is idempotent and marks an
    // in-flight session cancelled.
    cleanupThoughtSession(runId)
    resetThinkerConvergenceState(runId)
  }
}

const NATIVE_TOOL_CALL_RECOVERY_EXHAUSTED_MESSAGE =
  'Native tool-call recovery failed twice consecutively; ending the agent run without executing the incomplete tool call.'

const STEP_WARNING_MESSAGE = [
  "I've made quite a few responses in a row.",
  "Let me pause here to make sure we're still on the right track.",
  "Please let me know if you'd like me to continue or if you'd like to guide me in a different direction.",
].join(' ')

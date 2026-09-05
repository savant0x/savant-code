import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'
import { supportsCacheControl } from '@savant-code/common/old-constants'
import { serializeCacheDebugCorrelation } from '@savant-code/common/util/cache-debug'
import { systemMessage, userMessage } from '@savant-code/common/util/messages'

import { getAgentStreamFromTemplate } from '../prompt-agent-stream'
import { createCacheDebugSetup } from './cache-debug'
import { STEP_WARNING_MESSAGE } from './constants'
import { handleNParameterStep } from './n-parameter'
import { finalizeStep } from './step/finalize-step'
import { prepareStepHistory } from './step/prepare-step-history'
import { processStream } from '../tools/stream-parser'
import { setActivity } from '../util/activity-tracking'
import { withSystemTags, expireMessages } from '../util/messages'
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
    logger,
    prompt,
    repoId,
    spawnParams,
    system,
    userId,
    userInputId,
    onResponseChunk,
    trackEvent,
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
      lastIncompleteToolName: undefined,
      messageId: null,
    }
  }

  // FID-2026-0819-005 Loop 274: step-prompt resolution, message assembly,
  // relay digest, and the assistant-prefill guard (extracted verbatim to
  // step/prepare-step-history.ts).
  await prepareStepHistory(params, agentState)

  const { model } = agentTemplate

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
    // FID-2026-0821-001 P2-1: stamp provider-reported usage onto agentState
    // so prepareStepContext's reconcile path can prefer provider truth over
    // the ×1.35 local estimator (BYOK) and keep hosted endpoint counts
    // authoritative via the same freshness channel.
    onUsage: (usage) => {
      agentState.lastProviderUsage = {
        inputTokens: usage.inputTokens,
        capturedAt: Date.now(),
      }
    },
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

  const toolResults: ToolMessage[] = []

  // FID-2026-0718-009 M4: model stream starting — set activity to thinking.
  // P19 (operator: "the deck does not even show the model" + header badge
  // stayed empty): the thinking activity now carries the effective model id
  // (already UI-override-resolved via the agent template), so consumers can
  // display it without guessing. Schema allows the optional field
  // (print-mode.ts thinking variant) and the CLI's AgentStatus already reads
  // `activity.model` — this emit is the parity fix.
  setActivity(
    agentState,
    { kind: 'thinking', startedAt: Date.now(), model: agentTemplate.model },
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

  const streamOutcome = await processStream({
    ...params,
    agentContext,
    agentState,
    agentStepId,
    agentTemplate,
    fullResponse: '',
    messages: agentState.messageHistory,
    repoId,
    stream,
    onCostCalculated,
  })

  toolResults.push(...streamOutcome.toolResults)

  // FID-2026-0819-005 Loop 274: post-stream normalization, decisions,
  // anti-runaway guards, and settlement (extracted verbatim to
  // step/finalize-step.ts; streamOutcome carries the processStream fields
  // and fullResponse is passed explicitly).
  return finalizeStep({
    params,
    agentState,
    fullResponse: streamOutcome.fullResponse,
    stream: streamOutcome,
    iterationNum,
    startTime,
    stepCreditsUsed,
  })
}

export type RunAgentStepFn = typeof runAgentStep

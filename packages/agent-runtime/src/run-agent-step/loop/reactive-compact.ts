import { getErrorObject } from '@savant-code/common/util/error'

import { ContextCompactor } from '../../context-compactor'
import { getOrCreateEnforcement } from '../../echo/enforcement'
import { appendGroundingRefresh } from '../../echo/grounding'
import {
  appendCompactionInventory,
  describeRemovedToolItem,
  diffRemovedSpans,
} from '../../evidence/inventory'
import { getAgentOutput } from '../../util/agent-output'
import { recordPostCompact } from '../../util/token-telemetry'
import { runAgentStep } from '../step'

import type { LoopAgentStepsParams, LoopAgentStepsResult } from '../types'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type {
  RuntimeTraceEvent,
  TraceWriter,
} from '@savant-code/common/types/contracts/trace'
import type { CustomToolDefinitions } from '@savant-code/common/util/file'
import type { ToolSet } from 'ai'

type ReactiveCompactDeps = {
  contextCompactor: ContextCompactor
  initialAgentState: LoopAgentStepsParams['agentState']
  runId: string
  logger: Logger
  signal: AbortSignal
  traceWriter?: TraceWriter
  finishAgentRun: LoopAgentStepsParams['finishAgentRun']
  agentTemplate: NonNullable<LoopAgentStepsParams['agentTemplate']>
  system: string
  tools: ToolSet
  additionalToolDefinitionsWithCache: () => Promise<CustomToolDefinitions>
  getCachedAdditionalToolDefinitions: () => CustomToolDefinitions | undefined
  totalSteps: number
  currentPrompt?: string
  currentParams?: LoopAgentStepsParams['spawnParams']
}

function recordRuntimeEvent(
  event: RuntimeTraceEvent,
  traceWriter?: TraceWriter,
): void {
  try {
    traceWriter?.recordEvent?.(event)
  } catch {
    // Runtime tracing is observational and must never affect execution.
  }
}

/**
 * Layer 4 (FID-2026-0725-085) reactive compact: catch prompt-too-long errors,
 * aggressively truncate, and retry once before surfacing the error.
 *
 * Returns the successful retry result, or `null` when no compaction was
 * possible / the retry also failed (caller falls through to standard error
 * handling). Behavior identical to the inline block it was extracted from
 * (FID-2026-0809-016).
 */
export async function retryAfterReactiveCompact(params: {
  deps: ReactiveCompactDeps
  error: unknown
  loopParams: LoopAgentStepsParams
}): Promise<LoopAgentStepsResult | null> {
  const { deps, error, loopParams } = params
  const {
    contextCompactor,
    initialAgentState,
    runId,
    logger,
    signal,
    traceWriter,
    finishAgentRun,
    agentTemplate,
    system,
    tools,
    additionalToolDefinitionsWithCache,
    getCachedAdditionalToolDefinitions,
    totalSteps,
    currentPrompt,
    currentParams,
  } = deps

  if (!ContextCompactor.isPromptTooLongError(error) || signal.aborted) {
    return null
  }

  logger.warn(
    { error: getErrorObject(error) },
    'Layer 4 reactive compact: prompt-too-long detected, attempting emergency truncation',
  )
  const reactiveResult = contextCompactor.reactiveCompact(
    initialAgentState.messageHistory,
  )
  if (!reactiveResult.truncated) {
    return null
  }

  const beforeCount = initialAgentState.messageHistory.length
  // FID-2026-0824-027 post-closure amendment: PRE-history reference for the
  // inventory identity diff below (reactive truncation slices/filters
  // indices over the original array, so kept messages keep identity).
  const historyBeforeReactive = initialAgentState.messageHistory
  initialAgentState.messageHistory = reactiveResult.messages
  if (!initialAgentState.parentId) {
    appendGroundingRefresh(
      initialAgentState,
      getOrCreateEnforcement(initialAgentState).recordCompaction().refreshText,
    )
  }
  logger.warn(
    {
      messagesRemoved: beforeCount - reactiveResult.messages.length,
      tokensSaved: reactiveResult.tokensSaved,
    },
    `Layer 4 reactive compact: truncated ${beforeCount - reactiveResult.messages.length} messages, saved ~${reactiveResult.tokensSaved.toLocaleString()} tokens. Retrying API call once.`,
  )
  // FID-2026-0824-027 post-closure amendment: the emergency truncation layer
  // now writes its inventory row (+ metrics) like every other layer. The
  // deferral assumed ReactiveCompactDeps lacked projectRoot, but loopParams
  // already carries fileContext here — no deps threading required.
  const removalDiff = diffRemovedSpans({
    prev: historyBeforeReactive,
    next: initialAgentState.messageHistory,
    describeItem: describeRemovedToolItem,
  })
  void appendCompactionInventory({
    projectRoot: loopParams.fileContext?.projectRoot ?? '',
    runId,
    layer: 'reactive',
    removedMessages: beforeCount - reactiveResult.messages.length,
    tokensSaved: reactiveResult.tokensSaved,
    regions: removalDiff.regions,
    items: removalDiff.items,
  })
  const reactiveMetrics = initialAgentState.compactionMetrics ?? {
    events: 0,
    tokensSaved: 0,
  }
  initialAgentState.compactionMetrics = {
    events: reactiveMetrics.events + 1,
    tokensSaved: reactiveMetrics.tokensSaved + reactiveResult.tokensSaved,
  }
  // P4c (FID-2026-0806-003): PostCompact event (Axon pattern) with the
  // ratio metrics; feeds analytics + the CLI status surface. Non-blocking.
  try {
    recordPostCompact(
      {
        originalTokens: initialAgentState.contextTokenCount,
        compressedTokens: Math.max(
          0,
          initialAgentState.contextTokenCount - reactiveResult.tokensSaved,
        ),
        compressionRatio:
          initialAgentState.contextTokenCount > 0
            ? Math.min(
                1,
                reactiveResult.tokensSaved /
                  initialAgentState.contextTokenCount,
              )
            : 0,
        summaryPreview: `Reactive compact: ${beforeCount - reactiveResult.messages.length} messages removed (~${reactiveResult.tokensSaved.toLocaleString()} tokens)`,
        sessionId: runId,
      },
      logger,
    )
  } catch {
    // best-effort
  }

  // Retry the API call once after reactive compaction
  try {
    const retryResult = await runAgentStep({
      ...loopParams,
      agentState: initialAgentState,
      agentTemplate,
      n: undefined,
      prompt: currentPrompt,
      runId,
      spawnParams: currentParams,
      system,
      tools,
      additionalToolDefinitions: additionalToolDefinitionsWithCache,
      customToolDefinitions: getCachedAdditionalToolDefinitions(),
    })
    // Retry succeeded — use the result
    Object.assign(initialAgentState, retryResult.agentState)
    contextCompactor.recordCompactionResult(
      true,
      initialAgentState.contextTokenCount,
    )
    await finishAgentRun({
      ...loopParams,
      runId,
      status: 'completed',
      totalSteps,
      directCredits: initialAgentState.directCreditsUsed,
      totalCredits: initialAgentState.creditsUsed,
    })
    recordRuntimeEvent(
      {
        event: 'terminal',
        runId,
        agentId: initialAgentState.agentId,
        agentType: loopParams.agentType,
        status: 'completed',
        phase: 'step',
        step: totalSteps,
        reason: 'reactive_compact_retry',
      },
      traceWriter,
    )
    return {
      agentState: initialAgentState,
      output: getAgentOutput(initialAgentState, agentTemplate),
    }
  } catch (retryError) {
    // Retry also failed — log and fall through to standard error handling
    contextCompactor.recordCompactionResult(false)
    logger.error(
      { retryError: getErrorObject(retryError) },
      'Layer 4 reactive compact: retry also failed',
    )
    return null
  }
}

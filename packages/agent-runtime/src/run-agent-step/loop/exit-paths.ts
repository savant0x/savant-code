// FID-2026-0819-005 Loop 271: the agent loop's exit paths (abort, error,
// cleanup), extracted verbatim from loop.ts's catch/finally blocks. The
// parent keeps setup, the step loop, and the success path.
import { getErrorObject } from '@savant-code/common/util/error'
import { userMessage } from '@savant-code/common/util/messages'

import { getOrCreateEnforcement } from '../../echo/enforcement'
import { appendGroundingRefresh } from '../../echo/grounding'
import { clearProgrammaticRunState } from '../../run-programmatic-step'
import { resetThinkerConvergenceState } from '../../tools/thinker-convergence-gate'
import { cleanupThoughtSession } from '../../tools/thought-session-store'
import { buildLoopErrorOutput } from '../error-output'
import { retryAfterReactiveCompact } from './reactive-compact'
import { recordRuntimeEvent } from './runtime-events'
import { clearActivityIdleTimer } from '../../util/activity-tracking'
import { withSystemTags, expireMessages } from '../../util/messages'

import type {
  LoopIterationContext,
  LoopIterationState,
} from '../loop-iteration'
import type { LoopAgentStepsParams, LoopAgentStepsResult } from '../types'
import type { AgentState } from '@savant-code/common/types/session-state'

/** Everything the exit-path handlers need, sliced from loopAgentSteps scope. */
export type LoopExitPathDeps = {
  params: LoopAgentStepsParams
  state: LoopIterationState
  ctx: LoopIterationContext
  initialAgentState: AgentState
}

/**
 * Abort arm of the loop's catch block, verbatim (loop.ts): preserve work,
 * log, settle the run as cancelled, and return the cancellation output.
 */
export async function handleLoopAbort(
  deps: LoopExitPathDeps,
  error: unknown,
): Promise<LoopAgentStepsResult> {
  const { params, state, ctx, initialAgentState } = deps
  const { agentType, logger, finishAgentRun } = params
  // loop.ts destructures this with a default; replicate it exactly.
  const clearUserPromptMessagesAfterResponse =
    params.clearUserPromptMessagesAfterResponse ?? true
  const { runId } = ctx

  // Handle user-initiated aborts separately - don't log as errors
  if (clearUserPromptMessagesAfterResponse) {
    initialAgentState.messageHistory = expireMessages(
      initialAgentState.messageHistory,
      'userPrompt',
    )
  }

  initialAgentState.messageHistory = [
    ...initialAgentState.messageHistory,
    userMessage(
      withSystemTags(
        "User interrupted the response. The assistant's previous work has been preserved.",
      ),
    ),
  ]

  logger.info(
    {
      agentType,
      agentId: initialAgentState.agentId,
      runId,
      totalSteps: state.totalSteps,
      messageHistory: initialAgentState.messageHistory,
    },
    'Agent run cancelled by user (abort error)',
  )

  await finishAgentRun({
    ...params,
    runId,
    status: 'cancelled',
    totalSteps: state.totalSteps,
    directCredits: initialAgentState.directCreditsUsed,
    totalCredits: initialAgentState.creditsUsed,
  })
  recordRuntimeEvent(
    {
      event: 'terminal',
      runId,
      agentId: initialAgentState.agentId,
      agentType,
      status: 'cancelled',
      phase: 'step',
      step: state.totalSteps,
    },
    params.traceWriter,
  )

  return {
    agentState: initialAgentState,
    output: {
      type: 'error',
      message: 'Run cancelled by user',
    },
  }
}

/**
 * Error arm of the loop's catch block, verbatim (loop.ts): reactive-compact
 * retry first, then error logging, settlement, and output assembly.
 */
export async function handleLoopError(
  deps: LoopExitPathDeps,
  error: unknown,
): Promise<LoopAgentStepsResult> {
  const { params, state, ctx, initialAgentState } = deps
  const { agentType, logger, signal, finishAgentRun } = params
  const { runId, agentTemplate, system, tools, contextCompactor } = ctx
  const {
    additionalToolDefinitionsWithCache,
    getCachedAdditionalToolDefinitions,
  } = ctx

  // FID-2026-0725-085 Layer 4: Reactive compact — catch prompt-too-long errors,
  // aggressively truncate, and retry once before surfacing the error.
  const reactiveRetry = await retryAfterReactiveCompact({
    loopParams: params,
    error,
    deps: {
      contextCompactor,
      initialAgentState,
      runId,
      logger,
      signal,
      traceWriter: params.traceWriter,
      finishAgentRun,
      agentTemplate,
      system,
      tools,
      additionalToolDefinitionsWithCache,
      getCachedAdditionalToolDefinitions,
      totalSteps: state.totalSteps,
      currentPrompt: state.currentPrompt,
      currentParams: state.currentParams,
    },
  })
  if (reactiveRetry) {
    return reactiveRetry
  }

  logger.error(
    {
      error: getErrorObject(error),
      agentType,
      agentId: initialAgentState.agentId,
      runId,
      totalSteps: state.totalSteps,
      directCreditsUsed: initialAgentState.directCreditsUsed,
      creditsUsed: initialAgentState.creditsUsed,
      messageHistory: initialAgentState.messageHistory,
      systemPrompt: system,
    },
    'Agent execution failed',
  )

  const { status, errorMessage, statusCode, output } = buildLoopErrorOutput({
    error,
    signal,
  })

  if (status !== 'cancelled' && !initialAgentState.parentId) {
    const completionRefresh =
      getOrCreateEnforcement(initialAgentState).recordLogicalUserTurn()
    appendGroundingRefresh(initialAgentState, completionRefresh.refreshText)
  }
  await finishAgentRun({
    ...params,
    runId,
    status,
    totalSteps: state.totalSteps,
    directCredits: initialAgentState.directCreditsUsed,
    totalCredits: initialAgentState.creditsUsed,
    errorMessage,
  })
  recordRuntimeEvent(
    {
      event: 'terminal',
      runId,
      agentId: initialAgentState.agentId,
      agentType,
      status: status === 'cancelled' ? 'cancelled' : 'failed',
      phase: 'step',
      step: state.totalSteps,
      reason: errorMessage,
    },
    params.traceWriter,
  )

  // Payment required errors (402) should propagate
  if (statusCode === 402) {
    throw error
  }

  return {
    agentState: initialAgentState,
    output,
  }
}

/**
 * The loop's finally block, verbatim (loop.ts): run-state, timer, thought
 * session, and provenance cleanup on every exit path, then the cleanup
 * runtime event. `state.totalSteps` reads the live object after the
 * try/catch arms ran, exactly as the original finally scope did.
 */
export async function runLoopCleanup(deps: LoopExitPathDeps): Promise<void> {
  const { params, state, ctx, initialAgentState } = deps
  const { agentType } = params
  const { runId } = ctx

  // The endTurn path inside runProgrammaticStep handles normal completion,
  // but abort/error exits (e.g. chat SSE disconnects) would otherwise leak
  // the run's generator, STEP_ALL flag, and proposed file content forever.
  clearProgrammaticRunState(runId)
  // FID-2026-0815-015: disarm the idle heartbeat on every exit path so a
  // cancelled/failed run never leaves a live timer that mutates a frozen
  // agentState ~5s later (the confirmed "readonly property" crash).
  clearActivityIdleTimer(initialAgentState)
  // FID-2026-0801-012: per-run ThoughtSession and retry counters must not
  // leak across abort/error exits; cleanup is idempotent and marks an
  // in-flight session cancelled.
  cleanupThoughtSession(runId)
  resetThinkerConvergenceState(runId)
  // FID-2026-0813-004: finalize the ZTAP provenance session for the main
  // agent (best-effort, idempotent) so the ledger flushes and the manifest
  // carries the session-close record. Subagent loops inherit the parent's
  // session and must not finalize it.
  if (!initialAgentState.parentId) {
    const provenance = initialAgentState.provenance
    if (provenance && typeof provenance.finalize === 'function') {
      void provenance.finalize().catch(() => {
        // Best-effort: finalize must never break the run exit path.
      })
    }
  }
  recordRuntimeEvent(
    {
      event: 'cleanup_finished',
      runId,
      agentId: initialAgentState.agentId,
      agentType,
      phase: 'cleanup',
      step: state.totalSteps,
    },
    params.traceWriter,
  )
}

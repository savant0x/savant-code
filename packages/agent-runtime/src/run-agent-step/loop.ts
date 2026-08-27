import { isAbortError, getErrorObject } from '@savant-code/common/util/error'
import { userMessage } from '@savant-code/common/util/messages'

import { getOrCreateEnforcement } from '../echo/enforcement'
import { appendGroundingRefresh } from '../echo/grounding'
import { clearProgrammaticRunState } from '../run-programmatic-step'
import { buildLoopErrorOutput } from './error-output'
import { createLoopContext } from './loop-context'
import { runLoopIteration, type LoopIterationState } from './loop-iteration'
import { resetThinkerConvergenceState } from '../tools/thinker-convergence-gate'
import { cleanupThoughtSession } from '../tools/thought-session-store'
import { clearActivityIdleTimer } from '../util/activity-tracking'
import { getAgentOutput } from '../util/agent-output'
import { withSystemTags, expireMessages } from '../util/messages'
import { retryAfterReactiveCompact } from './loop/reactive-compact'
import { recordRuntimeEvent } from './loop/runtime-events'

import type { LoopAgentStepsParams, LoopAgentStepsResult } from './types'

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
  params: LoopAgentStepsParams,
): Promise<LoopAgentStepsResult> {
  const {
    agentState: initialAgentState,
    agentType,
    clearUserPromptMessagesAfterResponse = true,
    finishAgentRun,
    localAgentTemplates,
    logger,
    parentSystemPrompt,
    parentTools,
    prompt,
    signal,
    spawnParams,
  } = params

  const setupResult = await createLoopContext({
    params,
    agentState: initialAgentState,
    agentType,
    parentTools,
    parentSystemPrompt,
  })
  if (!setupResult.ok) {
    recordRuntimeEvent(
      {
        event: 'run_started',
        runId: undefined,
        agentId: setupResult.agentState.agentId,
        agentType,
        phase: 'setup',
        messageCount: setupResult.agentState.messageHistory.length,
      },
      params.traceWriter,
    )
    recordRuntimeEvent(
      {
        event: 'terminal',
        runId: undefined,
        agentId: setupResult.agentState.agentId,
        agentType,
        phase: 'setup',
        status: 'cancelled',
        reason: 'setup_cancelled',
      },
      params.traceWriter,
    )
    recordRuntimeEvent(
      {
        event: 'cleanup_finished',
        runId: undefined,
        agentId: setupResult.agentState.agentId,
        agentType,
        phase: 'cleanup',
      },
      params.traceWriter,
    )
    return {
      agentState: setupResult.agentState,
      output: {
        type: 'error',
        message: 'Run cancelled by user',
      },
    }
  }
  const {
    agentTemplate,
    runId,
    system,
    tools,
    toolsForTokenCount,
    additionalToolDefinitionsWithCache,
    getCachedAdditionalToolDefinitions,
    contextCompactor,
  } = setupResult.ctx

  // FID-2026-0825-001: the compactAndStop stamp is single-run coordination
  // between the serialized savant handleSteps interceptor and the output
  // assembly at the end of this loop. Wipe any stale value inherited through
  // a persisted snapshot so it can never mask a genuine error on this run;
  // the interceptor re-stamps it fresh when /compact actually fires.
  initialAgentState.compactAndStop = undefined

  recordRuntimeEvent(
    {
      event: 'run_started',
      runId,
      agentId: initialAgentState.agentId,
      agentType,
      phase: 'setup',
      messageCount: initialAgentState.messageHistory.length,
    },
    params.traceWriter,
  )

  // FID-2026-0810-002 Change 4: create the enforcement instance EAGERLY at
  // loop start (main agent) so `protocolRead` state exists before the first
  // step — a text-only first turn can no longer bypass the session-init gate
  // by never triggering lazy construction. Subagents are pre-seeded via the
  // factory (parentId) and skip eager creation here.
  if (!initialAgentState.parentId) {
    getOrCreateEnforcement(initialAgentState)
  }

  const state: LoopIterationState = {
    agentState: initialAgentState,
    shouldEndTurn: false,
    totalSteps: 0,
    nResponses: undefined,
    consecutiveNativeIncompleteSteps: 0,
    hasRetriedOutputSchema: false,
    currentPrompt: prompt,
    currentParams: spawnParams,
  }

  try {
    while (true) {
      const stepStartedAt = Date.now()
      recordRuntimeEvent(
        {
          event: 'step_started',
          runId,
          agentId: initialAgentState.agentId,
          agentType,
          phase: 'step',
          step: state.totalSteps + 1,
        },
        params.traceWriter,
      )
      let iteration: Awaited<ReturnType<typeof runLoopIteration>>
      try {
        iteration = await runLoopIteration({
          loopParams: params,
          state,
          ctx: {
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
          },
        })
      } catch (error) {
        recordRuntimeEvent(
          {
            event: 'step_finished',
            runId,
            agentId: initialAgentState.agentId,
            agentType,
            phase: 'step',
            step: state.totalSteps,
            status: 'failed',
            durationMs: Date.now() - stepStartedAt,
            reason: error instanceof Error ? error.name : 'unknown_error',
          },
          params.traceWriter,
        )
        throw error
      }
      recordRuntimeEvent(
        {
          event: 'step_finished',
          runId,
          agentId: initialAgentState.agentId,
          agentType,
          phase: 'step',
          step: state.totalSteps,
          status: 'completed',
          durationMs: Date.now() - stepStartedAt,
        },
        params.traceWriter,
      )
      if (!iteration.shouldContinue) {
        break
      }
    }

    if (clearUserPromptMessagesAfterResponse) {
      initialAgentState.messageHistory = expireMessages(
        initialAgentState.messageHistory,
        'userPrompt',
      )
    }

    if (!initialAgentState.parentId) {
      const completionRefresh =
        getOrCreateEnforcement(initialAgentState).recordLogicalUserTurn()
      appendGroundingRefresh(initialAgentState, completionRefresh.refreshText)
    }
    await finishAgentRun({
      ...params,
      runId,
      status: 'completed',
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
        status: 'completed',
        phase: 'step',
        step: state.totalSteps,
      },
      params.traceWriter,
    )

    // FID-2026-0825-001: a manual /compact run ends via compact-and-stop —
    // the interceptor spawns the pruner and returns without any LLM step, so
    // NO assistant turn exists for this run. getAgentOutput treats a
    // zero-assistant history as an error ("No response from agent"), which
    // fired deterministically whenever the compacted history contained no
    // surviving assistant messages (e.g. every /compact issued right after a
    // previous successful one); and even when older turns survived, they were
    // echoed as a stale fake "/compact response". Consume the one-shot stamp
    // and report an explicitly empty last-turn output instead — success with
    // nothing new to render (CompactionSignal carries the outcome).
    if (initialAgentState.compactAndStop === true) {
      initialAgentState.compactAndStop = undefined
      return {
        agentState: initialAgentState,
        output: { type: 'lastMessage', value: [] },
      }
    }

    return {
      agentState: initialAgentState,
      output: getAgentOutput(initialAgentState, agentTemplate),
    }
  } catch (error) {
    // Handle user-initiated aborts separately - don't log as errors
    if (isAbortError(error)) {
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
  } finally {
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
}

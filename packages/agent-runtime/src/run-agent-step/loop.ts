import { isAbortError } from '@savant-code/common/util/error'

import { createLoopContext } from './loop-context'
import {
  runLoopIteration,
  type LoopIterationContext,
  type LoopIterationState,
} from './loop-iteration'
import { getOrCreateEnforcement } from '../echo/enforcement'
import { appendGroundingRefresh } from '../echo/grounding'
import { getAgentOutput } from '../util/agent-output'
import { expireMessages } from '../util/messages'
import {
  handleLoopAbort,
  handleLoopError,
  runLoopCleanup,
} from './loop/exit-paths'
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

  // FID-2026-0819-005 Loop 271: the per-iteration context is immutable
  // across iterations (verified: no consumer mutates ctx fields), so it is
  // built once and shared by the step loop and the exit-path handlers.
  const iterationCtx: LoopIterationContext = {
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
  }

  // Everything the extracted exit paths (loop/exit-paths.ts) need. `state`
  // is passed by reference so cleanup observes the post-run totalSteps.
  const exitDeps = { params, state, ctx: iterationCtx, initialAgentState }

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
          ctx: iterationCtx,
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
      return await handleLoopAbort(exitDeps, error)
    }
    return await handleLoopError(exitDeps, error)
  } finally {
    await runLoopCleanup(exitDeps)
  }
}

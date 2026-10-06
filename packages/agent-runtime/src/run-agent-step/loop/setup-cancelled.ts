import { recordRuntimeEvent } from './runtime-events'
import { fireMainAgentTerminalHook } from '../../hooks/lifecycle-hooks'

import type { createLoopContext } from '../loop-context'
import type { LoopAgentStepsParams, LoopAgentStepsResult } from '../types'

/**
 * FID-2026-1006-003 (quality-gate): the setup-phase cancellation exit,
 * extracted verbatim from loopAgentSteps. Emits the run_started/terminal/
 * cleanup_finished trace events and reports `Interrupt` — never `Stop`
 * (FID-2026-0919-031: nobody finished a turn).
 */
export function handleSetupCancelled({
  setupResult,
  params,
}: {
  setupResult: Extract<
    Awaited<ReturnType<typeof createLoopContext>>,
    { ok: false }
  >
  params: LoopAgentStepsParams
}): LoopAgentStepsResult {
  const { agentState } = setupResult
  const { agentType } = params
  recordRuntimeEvent(
    {
      event: 'run_started',
      runId: undefined,
      agentId: agentState.agentId,
      agentType,
      phase: 'setup',
      messageCount: agentState.messageHistory.length,
    },
    params.traceWriter,
  )
  recordRuntimeEvent(
    {
      event: 'terminal',
      runId: undefined,
      agentId: agentState.agentId,
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
      agentId: agentState.agentId,
      agentType,
      phase: 'cleanup',
    },
    params.traceWriter,
  )
  fireMainAgentTerminalHook({
    event: 'Interrupt',
    agentState,
    fileContext: params.fileContext,
    errorMessage: 'Run cancelled by user',
  })

  return {
    agentState,
    output: {
      type: 'error',
      message: 'Run cancelled by user',
    },
  }
}

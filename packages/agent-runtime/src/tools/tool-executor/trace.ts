import type { TraceWriter } from '@savant-code/common/types/contracts/trace'

export type ToolTraceStatus = 'completed' | 'failed' | 'cancelled'

export type ToolTrace = {
  recordToolEvent: (
    event: 'tool_started' | 'tool_finished',
    status?: ToolTraceStatus,
  ) => void
  finishToolEvent: (status: ToolTraceStatus) => void
}

/**
 * Runtime tool-event trace recorder (extracted verbatim from
 * `tool-executor/native.ts` — FID-2026-0905-001). Encapsulates the once-only
 * `tool_finished` flag: exactly one finish event fires per tool call no
 * matter how many lifecycle branches attempt to finish it. Runtime tracing
 * is observational and must never affect execution.
 */
export function createToolTrace(params: {
  traceWriter?: TraceWriter
  runId: string
  agentId: string
  agentType: string
  toolName: string
}): ToolTrace {
  const { traceWriter, runId, agentId, agentType, toolName } = params
  const toolStartedAt = Date.now()
  let toolFinished = false
  const recordToolEvent = (
    event: 'tool_started' | 'tool_finished',
    status?: ToolTraceStatus,
  ): void => {
    try {
      traceWriter?.recordEvent?.({
        event,
        runId,
        agentId,
        agentType,
        phase: 'tool',
        status,
        toolName: String(toolName).slice(0, 80),
        durationMs:
          event === 'tool_finished' ? Date.now() - toolStartedAt : undefined,
      })
    } catch {
      // Runtime tracing is observational and must never affect execution.
    }
  }
  const finishToolEvent = (status: ToolTraceStatus): void => {
    if (toolFinished) return
    toolFinished = true
    recordToolEvent('tool_finished', status)
  }
  return { recordToolEvent, finishToolEvent }
}

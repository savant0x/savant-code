import type { Message } from '../messages/savant-code-message'

/** Fixed-shape lifecycle events used for bounded runtime instrumentation. */
export type RuntimeTraceEvent = {
  event:
    | 'run_started'
    | 'step_started'
    | 'step_finished'
    | 'tool_started'
    | 'tool_finished'
    | 'terminal'
    | 'cleanup_finished'
  runId: string | undefined
  agentId: string
  agentType: string
  step?: number
  phase?: 'setup' | 'step' | 'model' | 'tool' | 'cleanup'
  status?: 'completed' | 'failed' | 'cancelled' | 'skipped'
  durationMs?: number
  toolName?: string
  reason?: string
  messageCount?: number
}

/**
 * Records agent message histories for debugging (e.g. to a trace.jsonl file).
 *
 * Callers pass the agent's full message history at each step boundary;
 * implementations are expected to persist each message only once (appending
 * the delta since the previous call for the same agentId), so calling this
 * every step does not grow storage quadratically.
 */
export type TraceWriter = {
  /** Optional bounded lifecycle event sink. Implementations must be best effort. */
  recordEvent?: (event: RuntimeTraceEvent) => void
  recordStep: (params: {
    agentId: string
    agentType: string
    runId: string | undefined
    userInputId: string
    step: number
    system: string | undefined
    messages: Message[]
  }) => void
  /** Await pending async writes. Optional — only async implementations expose it. */
  flush?: () => Promise<void>
}

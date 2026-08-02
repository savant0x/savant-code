import type { EchoPhase, RunFault, TraceDocument, TraceEvent } from './runner'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { RunState } from '@savant-code/sdk'

const VALID_PHASES: EchoPhase[] = [
  'idle',
  'red',
  'green',
  'audit',
  'self_correct',
  'complete',
]

function isValidPhase(value: unknown): value is EchoPhase {
  return typeof value === 'string' && VALID_PHASES.includes(value as EchoPhase)
}

/**
 * Collects every event emitted during a benchmark run and builds the canonical
 * {@link TraceDocument}.
 *
 * The collector is intentionally thin: it does not interpret events, only
 * stores them. Interpretation (FSM scoring, metrics) is handled by the
 * {@link MetricAggregator} after the run.
 */
export class TraceCollector {
  private events: TraceEvent[] = []
  private currentPhase: EchoPhase = 'idle'
  private subagentCount = 0
  private toolCallCount = 0
  private phaseTransitionCount = 0
  private finalState?: RunState
  private endTime?: string

  constructor(
    private readonly taskId: string,
    private readonly runId: string,
    private readonly startTime: string = new Date().toISOString(),
  ) {}

  /** Record a raw {@link PrintModeEvent} from the runtime. */
  recordPrintEvent(event: PrintModeEvent): void {
    this.events.push({ type: 'print', raw: event })

    if (event.type === 'tool_call') {
      this.toolCallCount += 1
      if (event.toolName === 'transition_phase') {
        this.recordPhaseTransition(
          event.input as Record<string, unknown>,
          event.toolCallId,
        )
      }
    }

    if (event.type === 'subagent_start') {
      this.subagentCount += 1
    }
  }

  /** Record a stream chunk from the runtime. */
  recordStreamChunk(
    chunk:
      | string
      | {
          type: 'subagent_chunk'
          agentId: string
          agentType: string
          chunk: string
        }
      | {
          type: 'reasoning_chunk'
          agentId: string
          ancestorRunIds: string[]
          chunk: string
        },
  ): void {
    if (typeof chunk === 'string') {
      this.events.push({
        type: 'subagent_chunk',
        agentId: 'main',
        agentType: 'main',
        chunk,
      })
      return
    }

    if (chunk.type === 'subagent_chunk') {
      this.events.push({
        type: 'subagent_chunk',
        agentId: chunk.agentId,
        agentType: chunk.agentType,
        chunk: chunk.chunk,
      })
    } else if (chunk.type === 'reasoning_chunk') {
      this.events.push({
        type: 'reasoning_chunk',
        agentId: chunk.agentId,
        ancestorRunIds: chunk.ancestorRunIds,
        chunk: chunk.chunk,
      })
    }
  }

  /** Record a harness-injected fault. */
  recordFault(fault: RunFault): void {
    this.events.push({ type: 'fault_injected', fault })
  }

  /**
   * Record a phase transition directly.
   *
   * Used internally when a `transition_phase` tool call is observed.
   */
  private recordPhaseTransition(
    input: Record<string, unknown>,
    toolCallId?: string,
  ): void {
    const requestedPhase = input?.phase
    if (!isValidPhase(requestedPhase)) {
      return
    }

    const from = this.currentPhase
    const to: EchoPhase = requestedPhase
    this.currentPhase = to
    this.phaseTransitionCount += 1

    this.events.push({
      type: 'phase_transition',
      from,
      to,
      toolCallId,
    })
  }

  /** Finalize the collected trace into a {@link TraceDocument}. */
  finalize(
    finalState?: RunState,
    endTime: string = new Date().toISOString(),
  ): TraceDocument {
    this.finalState = finalState
    this.endTime = endTime

    // Synchronize the collector's current phase from the runtime's final state
    // without emitting an extra phase_transition event.
    const finalPhase = finalState?.sessionState?.mainAgentState?.fsmPhase
    if (isValidPhase(finalPhase)) {
      this.currentPhase = finalPhase
    }

    const mainAgentState = finalState?.sessionState?.mainAgentState
    const creditsUsed = mainAgentState?.creditsUsed
    const directCreditsUsed = mainAgentState?.directCreditsUsed
    const contextTokenCount = mainAgentState?.contextTokenCount

    const durationMs =
      this.startTime && this.endTime
        ? new Date(this.endTime).getTime() - new Date(this.startTime).getTime()
        : undefined

    return {
      task_id: this.taskId,
      run_id: this.runId,
      started_at: this.startTime,
      finished_at: this.endTime,
      events: this.events,
      final_state: finalState,
      current_phase: this.currentPhase,
      metadata: {
        duration_ms: durationMs,
        total_steps: this.events.length,
        subagent_count: this.subagentCount,
        tool_call_count: this.toolCallCount,
        phase_transition_count: this.phaseTransitionCount,
        final_phase: this.currentPhase,
        credits_used: typeof creditsUsed === 'number' ? creditsUsed : undefined,
        direct_credits_used:
          typeof directCreditsUsed === 'number' ? directCreditsUsed : undefined,
        context_token_count:
          typeof contextTokenCount === 'number' ? contextTokenCount : undefined,
        cost_usd:
          typeof creditsUsed === 'number' ? creditsUsed / 100 : undefined,
      },
    }
  }
}

import type {
  AgentOutput,
  AgentState,
} from '@savant-code/common/types/session-state'

/**
 * FID-2026-0919-029 (subagent lifecycle) / FID-2026-0919-030 (session
 * lifecycle) — what an operator hook learns about a run that just ended.
 *
 * Both lifecycles had the same hole: the payload carried identity and nothing
 * else, so a completed run and a crashed one were indistinguishable at the hook.
 * The contract already supported the outcome fields (`tool_result` /
 * `error_message` — the same ones `PostToolUse` / `PostToolUseFailure` use); the
 * call sites simply never set them.
 *
 * ONE builder, two named entry points, on purpose. FID-2026-0919-027 paid for
 * two implementations of the same boundary binding (the verdict-receipt block
 * copied at both spawn sites) with a silent divergence; the session and subagent
 * lifecycles are exactly the shape where a second copy would drift next.
 *
 * Three outcomes are distinguished, because they are genuinely different:
 *
 * 1. **completed** — the loop returned and produced usable output.
 * 2. **failed (threw)** — the loop raised (abort, provider error, tool
 *    explosion); the caller rethrows, and the hook names the cause.
 * 3. **failed (no usable output)** — the loop returned the error form:
 *    `getAgentOutput` found no assistant turn (the silent-pass class
 *    FID-2026-0823-008 hit for the recorder) or the loop's own error arm
 *    produced `{ type: 'error', message }`. Reported as a failure on purpose,
 *    since that is how a consumer must treat it. A user cancellation lands here
 *    too (`{ type: 'error', message: 'Run cancelled by user' }`), so a cancelled
 *    run is never reported as a completed deliverable.
 *
 * The payload deliberately carries identity and shape, never content: hook
 * commands receive this as JSON on stdin, and copying a transcript or verdict
 * into every hook invocation would be both unbounded and a content-leak path.
 * Consumers that need the text read the run's trace.
 */

export type RunOutcomeStatus = 'completed' | 'failed'

export type RunOutcome = {
  status: RunOutcomeStatus
  /** The acting agent's type. Absent for the session lifecycle. */
  agentType?: string
  runId: string | null
  creditsUsed: number
  outputType: AgentOutput['type'] | null
  errorMessage?: string
}

/** FID-2026-0919-029's public shape — the subagent lifecycle names the agent. */
export type SubagentOutcome = RunOutcome & { agentType: string }
export type SubagentOutcomeStatus = RunOutcomeStatus

/** What the "no result" message names — keeps each lifecycle's message precise. */
export type RunOutcomeSubject = 'Run' | 'Subagent' | 'Session'

export function buildRunOutcome(params: {
  /** The acting agent's type, when the lifecycle knows it. */
  agentType?: string
  /** Present only when the loop returned; absent when it threw. */
  result?: { agentState: AgentState; output: AgentOutput }
  /** The thrown value, when the loop threw. */
  error?: unknown
  /**
   * Named so the "finished without a result" message reads correctly per
   * lifecycle. FID-2026-0919-029 pinned `'Subagent finished without a result'`,
   * and a closed record's evidence must stay literally true.
   */
  subject?: RunOutcomeSubject
}): RunOutcome {
  const { agentType, result, error, subject = 'Run' } = params

  const identity = {
    ...(agentType !== undefined ? { agentType } : {}),
    runId: result?.agentState.runId ?? null,
    creditsUsed: result?.agentState.creditsUsed ?? 0,
  }

  if (error !== undefined) {
    return {
      ...identity,
      status: 'failed',
      outputType: result?.output.type ?? null,
      errorMessage: errorMessageOf(error),
    }
  }

  if (!result) {
    // Defensive: reaching a boundary with neither a result nor an error means
    // the outcome is unknown, which a consumer must treat as a failure rather
    // than assume success.
    return {
      ...identity,
      status: 'failed',
      outputType: null,
      errorMessage: `${subject} finished without a result`,
    }
  }

  const { output } = result
  if (output.type === 'error') {
    return {
      ...identity,
      status: 'failed',
      outputType: output.type,
      errorMessage: output.message,
    }
  }

  return { ...identity, status: 'completed', outputType: output.type }
}

/** The subagent lifecycle's entry point (FID-2026-0919-029). */
export function buildSubagentOutcome(params: {
  agentType: string
  result?: { agentState: AgentState; output: AgentOutput }
  error?: unknown
}): SubagentOutcome {
  return buildRunOutcome({ ...params, subject: 'Subagent' }) as SubagentOutcome
}

/** The session lifecycle's entry point (FID-2026-0919-030). */
export function buildSessionOutcome(params: {
  result?: { agentState: AgentState; output: AgentOutput }
  error?: unknown
}): RunOutcome {
  return buildRunOutcome({ ...params, subject: 'Session' })
}

export function errorMessageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

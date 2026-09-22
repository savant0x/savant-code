import { buildHookInput, getHookEngine } from './engine'

import type { JSONValue } from '@savant-code/common/types/json'
import type {
  AgentOutput,
  AgentState,
} from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'

/**
 * FID-2026-0919-031 — the lifecycle events that had no firing site, with the
 * semantics ruling written where the wiring lives.
 *
 * FID-2026-0919-030 found five declared events with zero firing sites
 * (`PreCompact`, `PostCompact`, `Stop`, `Interrupt`, `Notification`) and
 * declared each inert *with its blocker*, because wiring them meant inventing
 * contracts. This module is the ruling and the wiring.
 *
 * ## `Stop` vs `Interrupt` — who ended the turn
 *
 * The two were documented as the same thing ("Cancellation / interruption") and
 * the runtime had no basis to separate them. The split is now **who ended it**,
 * and it is mutually exclusive per turn:
 *
 * - **`Stop`** — the agent finished its turn on its own terms. Fires once per
 *   MAIN-agent loop that reaches terminal completion, carrying the outcome
 *   (`completed` with the output type, or `failed` with the reason). This is the
 *   event a "run the formatter at end of turn" hook wants, so it must not fire
 *   for a turn nobody finished.
 * - **`Interrupt`** — the turn ended because it was CANCELLED (operator abort,
 *   or an abort observed during error handling). Carries the cancellation
 *   message.
 *
 * A **failure** fires neither: the turn did not finish (so no `Stop`) and was
 * not cancelled (so no `Interrupt`); the failure is reported by `SessionEnd`,
 * which FID-2026-0919-030 gave the outcome. Stated here because "neither fires"
 * is otherwise indistinguishable from "the wiring missed a path".
 *
 * Both are gated on `!agentState.parentId`: children are already covered by
 * `SubagentStart`/`SubagentStop` at the `executeSubagent` funnel, and a child
 * deciding it owns the session boundary is exactly the cross-run confusion
 * FID-2026-0919-027 fixed for governance fields.
 *
 * ## `PreCompact` vs `PostCompact` — attempt vs effect
 *
 * The asymmetry is deliberate, and it is the answer to "what is the predicate?":
 *
 * - **`PreCompact`** is ATTEMPT-based: it fires when a compaction attempt
 *   begins, which is what its own name can honestly mean (a `Pre` event cannot
 *   know the effect). The attempt is the pruner spawn — the one compaction path
 *   with a resolved trigger, a terminal status, and the `/compact` operator
 *   surface.
 * - **`PostCompact`** is EFFECT-based: it fires only when the compaction
 *   actually compacted — the same predicate the runtime already uses for the
 *   `pruned` phase (`messagesRemoved > 0 && tokensSaved > 0`) and for the
 *   `compaction_summary` wire event. A `PostCompact` on a no-op attempt would
 *   tell an operator the context was compacted when nothing changed, which is
 *   precisely the lying-event failure this work exists to prevent.
 *
 * Consequence, stated so it is not read as a bug: an ineffective attempt emits a
 * `PreCompact` with no matching `PostCompact`. That IS the signal (the attempt
 * happened and changed nothing), and the `ineffective` compaction status carries
 * it for the UI.
 *
 * The per-step L0 micro-compact pass is deliberately NOT an event source: it is
 * a cheap trim that can run on most steps, so an event per step is noise, and its
 * own `compactionStatus.phase: 'compacted'` telemetry already covers it.
 *
 * ## `Notification` — the agent needs a human
 *
 * Fired when the runtime hands control to the operator: an `ask_user` call. That
 * is the one unambiguous "the agent needs your attention" moment in this
 * runtime, it is a single seam, and it carries the questions as `tool_input`.
 */

/** A hook needs a project root to read `protocol.config.yaml` from. */
function resolveProjectRoot(
  fileContext: ProjectFileContext | undefined,
): string | undefined {
  const root = fileContext?.projectRoot ?? fileContext?.cwd
  return root ? root : undefined
}

/**
 * `Stop` (normal completion) / `Interrupt` (cancellation) for the MAIN agent.
 * No-ops for a child run — children report through `SubagentStop`.
 */
export function fireMainAgentTerminalHook(params: {
  event: 'Stop' | 'Interrupt'
  agentState: AgentState
  fileContext: ProjectFileContext | undefined
  outputType?: AgentOutput['type'] | null
  errorMessage?: string
  creditsUsed?: number
}): void {
  const { event, agentState, outputType, errorMessage, creditsUsed } = params
  if (agentState.parentId) return

  const projectRoot = resolveProjectRoot(params.fileContext)
  if (!projectRoot) return

  const outcome: JSONValue = {
    status:
      event === 'Interrupt'
        ? 'cancelled'
        : errorMessage
          ? 'failed'
          : 'completed',
    runId: agentState.runId ?? null,
    creditsUsed: creditsUsed ?? agentState.creditsUsed ?? 0,
    outputType: outputType ?? null,
  }

  getHookEngine(projectRoot).fireAndForgetTrigger(
    buildHookInput({
      event,
      sessionId: agentState.runId ?? agentState.agentId,
      cwd: projectRoot,
      toolResult: outcome,
      ...(errorMessage !== undefined ? { errorMessage } : {}),
    }),
  )
}

/**
 * `PreCompact` (attempt begins) / `PostCompact` (compaction had an effect).
 * `toolResult` carries the compaction facts the caller actually knows.
 */
export function fireCompactionHook(params: {
  event: 'PreCompact' | 'PostCompact'
  parentAgentState: AgentState
  projectRoot: string | undefined
  toolResult: JSONValue
}): void {
  const { event, parentAgentState, projectRoot, toolResult } = params
  if (!projectRoot) return

  getHookEngine(projectRoot).fireAndForgetTrigger(
    buildHookInput({
      event,
      sessionId: parentAgentState.runId ?? parentAgentState.agentId,
      cwd: projectRoot,
      toolResult,
    }),
  )
}

/**
 * `Notification` — the runtime needs the operator (an `ask_user` call).
 *
 * `toolName` is the caller's, not the default: a notification raised for some
 * other reason must not claim `ask_user` produced it. Reporting a tool that did
 * not run is the same class of untruth as the lying `PostCompact` this FID
 * refused, so the field is absent unless the caller states it.
 */
export function fireNotificationHook(params: {
  agentState: AgentState
  fileContext: ProjectFileContext | undefined
  reason: string
  toolName?: string
  toolInput?: Record<string, JSONValue>
}): void {
  const { agentState, reason, toolName, toolInput } = params
  const projectRoot = resolveProjectRoot(params.fileContext)
  if (!projectRoot) return

  getHookEngine(projectRoot).fireAndForgetTrigger(
    buildHookInput({
      event: 'Notification',
      sessionId: agentState.runId ?? agentState.agentId,
      cwd: projectRoot,
      ...(toolName !== undefined ? { toolName } : {}),
      ...(toolInput !== undefined ? { toolInput } : {}),
      toolResult: { reason } as JSONValue,
    }),
  )
}

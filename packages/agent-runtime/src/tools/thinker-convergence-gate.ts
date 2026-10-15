import {
  thinkerFinalArtifactToJSONValue,
  type ThinkerFinalArtifact,
} from '@savant-code/common/tools/sequential-thinking'
import { userMessage } from '@savant-code/common/util/messages'

import {
  cleanupThoughtSession,
  getThoughtSessionIfExists,
} from './thought-session-store'
import { withSystemTags } from '../util/messages'

import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * FID-2026-0801-012: runtime convergence gate.
 *
 * Runs at the runtime boundary (in `loopAgentSteps`, after the native step's
 * tool results are committed to history) for Thinker-like agents — the ONLY
 * agent with `sequentialthinking` in `toolNames`. It replaces the removed
 * `handleSteps` text-parsing finalizer.
 *
 * Behavior when the model ended its turn (`shouldEndTurn === true`):
 * - Session converged (last thought `nextThoughtNeeded === false`) → build the
 *   `FinalArtifact` from the session snapshot (never from assistant text), set
 *   `agentState.output` once, clean up the session.
 * - Thoughts accepted but NOT converged (model wrote its conclusion as plain
 *   text and stopped) → non-convergence: append one typed retry message asking
 *   for a final `nextThoughtNeeded: false` thought; after the consecutive cap
 *   (3) → `exhausted` with partial synthesis. Never a fake success.
 * - No accepted thoughts → retry message; after the cap → `failed`.
 *
 * The gate ALWAYS sets `agentState.output` for every terminal status (success,
 * exhausted, failed) and the loop runs it BEFORE the `output === undefined &&
 * shouldEndTurn` restart check, so the "You must use set_output" branch can
 * never reintroduce `structuredOutput: null` for the Thinker.
 */
export const MAX_CONSECUTIVE_RETRIES = 3

const consecutiveRetries = new Map<string, number>()

export interface ThinkerConvergenceGateResult {
  /** True when the gate appended a retry message and the loop must continue. */
  retryAppended: boolean
  /** True when the gate set a terminal `agentState.output` (success/exhausted/failed). */
  terminal: boolean
}

export function runThinkerConvergenceGate(params: {
  runId: string
  agentState: AgentState
  shouldEndTurn: boolean
  logger: Logger
}): ThinkerConvergenceGateResult {
  const { runId, agentState, shouldEndTurn, logger } = params

  if (!shouldEndTurn) {
    // Mid-reasoning: keep looping normally (native continuation).
    return { retryAppended: false, terminal: false }
  }

  if (agentState.output !== undefined) {
    // Output already set (e.g. a terminal path finalized this run, or a
    // steering message kept the loop alive after finalization). Never
    // clobber it or append a retry on top of a completed run.
    return { retryAppended: false, terminal: false }
  }

  const session = getThoughtSessionIfExists(runId)
  const snapshot = session?.getSnapshot()
  const thoughtCount = snapshot?.length ?? 0
  const converged = snapshot?.converged ?? false

  if (converged && thoughtCount > 0 && session && snapshot) {
    // Build the FinalArtifact from the session snapshot — the last accepted
    // thought (nextThoughtNeeded=false) carries the conclusion.
    const lastThought = snapshot.thoughts[snapshot.thoughts.length - 1]!
    const artifact: ThinkerFinalArtifact = session.finalize({
      message: lastThought.thought,
    })
    agentState.output = thinkerFinalArtifactToJSONValue(artifact)
    cleanupThoughtSession(runId)
    consecutiveRetries.delete(runId)
    logger.debug(
      {
        runId,
        totalThoughts: artifact.metrics.totalThoughts,
        branches: artifact.metrics.branches,
      },
      'Thinker converged — final artifact built from session snapshot',
    )
    return { retryAppended: false, terminal: true }
  }

  // Non-convergence (or no thoughts at all). Bounded retry with a consecutive
  // error cap to prevent token-burning loops.
  const attempt = (consecutiveRetries.get(runId) ?? 0) + 1
  consecutiveRetries.set(runId, attempt)

  if (attempt >= MAX_CONSECUTIVE_RETRIES) {
    const status = thoughtCount === 0 ? 'failed' : 'exhausted'
    const error =
      thoughtCount === 0
        ? 'The Thinker ended its turn without accepting any sequentialthinking thoughts.'
        : `The Thinker ended its turn ${attempt} times without a converged final thought (nextThoughtNeeded=false).`
    const artifact: ThinkerFinalArtifact =
      session?.fail(status, error) ??
      buildStandaloneFailedArtifact(status, error)
    agentState.output = thinkerFinalArtifactToJSONValue(artifact)
    cleanupThoughtSession(runId)
    consecutiveRetries.delete(runId)
    logger.warn(
      { runId, attempt, thoughtCount, status },
      `Thinker non-convergence cap reached — terminal '${status}' artifact set`,
    )
    return { retryAppended: false, terminal: true }
  }

  // Append a typed retry message and keep the loop going.
  const retryMessage =
    thoughtCount === 0
      ? 'You ended your turn without using the sequentialthinking tool. Reason through the problem with at least one sequentialthinking call, and make your final call set nextThoughtNeeded=false with the complete conclusion in the thought text.'
      : `You ended your turn before converging. Your sequentialthinking session has ${thoughtCount} accepted thought(s), but the last thought did not set nextThoughtNeeded=false. Append one final sequentialthinking call with nextThoughtNeeded=false whose thought text contains your complete conclusion.`
  agentState.messageHistory = [
    ...agentState.messageHistory,
    userMessage({
      content: withSystemTags(retryMessage),
      keepDuringTruncation: true,
    }),
  ]
  logger.warn(
    { runId, attempt, thoughtCount },
    `Thinker non-convergence — retry message appended (${attempt}/${MAX_CONSECUTIVE_RETRIES})`,
  )
  return { retryAppended: true, terminal: false }
}

/** Resets the per-run consecutive-retry counter (e.g., on loop teardown). */
export function resetThinkerConvergenceState(runId: string): void {
  consecutiveRetries.delete(runId)
}

/** Test-only: clear all retry counters. */
export function clearThinkerConvergenceStateForTests(): void {
  consecutiveRetries.clear()
}

/** Builds a terminal artifact when no session exists (zero thoughts). */
function buildStandaloneFailedArtifact(
  status: 'failed' | 'exhausted',
  error: string,
): ThinkerFinalArtifact {
  return {
    status,
    synthesis: 'No sequential thinking thoughts were accepted.',
    payload: null,
    metrics: { totalThoughts: 0, durationMs: 0, branches: [] },
    thoughts: [],
    error,
  }
}

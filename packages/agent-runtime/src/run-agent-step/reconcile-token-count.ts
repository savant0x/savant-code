import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * FID-2026-0821-001 P2-1: single precedence owner for the context token
 * count.
 *
 * Precedence:
 * 1. Provider-reported usage (`agentState.lastProviderUsage`) when it is
 *    FRESHER than the most recent history replacement — wall-clock compare
 *    against `lastPrunerCompletionAt`. Provider truth beats every estimate.
 * 2. `localEstimate` otherwise: the ×1.35 estimator before the first
 *    response of a run, or the post-prune local recount written by the
 *    spawn boundary (stale usage loses to the fresher
 *    `lastPrunerCompletionAt` stamp, so the recount stands).
 *
 * Hosted runs stamp the accurate endpoint count into `lastProviderUsage`
 * too, so both modes converge through this one entry point — precedence
 * cannot fork between BYOK and hosted.
 *
 * FID-2026-0821-003-A: optional per-step decision logger. The caller
 * (`prepareStepContext`) already has a logger in scope; emitting the chosen
 * source + inputs makes the estimator↔truth alternation reproducible from
 * logs. The logger is OPTIONAL so the existing test call sites (and any
 * non-logging consumer) are unchanged — observability never gates the
 * reconcile.
 */
export function reconcileTokenCount(params: {
  agentState: AgentState
  /** The count the current step just computed (estimate or endpoint). */
  localEstimate: number
  /** FID-2026-0821-003-A: optional per-step decision sink. */
  logger?: Logger
}): number {
  const { agentState, localEstimate, logger } = params
  const usage = agentState.lastProviderUsage
  const lastCompactionAt = agentState.lastPrunerCompletionAt ?? 0
  // FID-2026-1009-002: a provider usage with a missing or non-positive
  // inputTokens is "no reading", not truth — some streams finalize with a
  // zero or unset input-token count. Preferring it would set the count to 0
  // mid-run: the sidebar meter wipes to 0/1,000,000 AND the compaction gates
  // (shouldAutoCompact / percentUsed) see an empty context, silently
  // disabling proactive compaction until the next step's estimator. Fall
  // back to the local estimate when the reported count is not a real
  // positive number.
  const hasUsableProviderUsage =
    typeof usage?.inputTokens === 'number' && usage.inputTokens > 0
  const choseProviderUsage = Boolean(
    usage && hasUsableProviderUsage && usage.capturedAt > lastCompactionAt,
  )
  const result = choseProviderUsage && usage ? usage.inputTokens : localEstimate
  // FID-2026-0821-003-A: bounded observability — a logger failure must never
  // break the count reconcile.
  try {
    logger?.debug(
      {
        choseProviderUsage,
        usageCapturedAt: usage?.capturedAt ?? null,
        lastPrunerCompletionAt: lastCompactionAt,
        localEstimate,
        result,
        deltaFromEstimate: result - localEstimate,
      },
      'reconcileTokenCount: context token source decision',
    )
  } catch {
    // ignore — observability must never gate context counting
  }
  return result
}

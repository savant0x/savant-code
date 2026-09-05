/**
 * @module run-agent-step/context-tokens-compaction
 *
 * FID-2026-0819-005 Loop 253: the micro-compact pass and the compaction
 * status-resolution block, extracted verbatim from context-tokens.ts.
 * Pure state transitions over the caller's agentState; the parent
 * orchestrates token counting and the step prompt.
 */

import { shouldBoundaryCompact } from './auto-drive-driver'
import { getOrCreateEnforcement } from '../echo/enforcement'
import { appendGroundingRefresh } from '../echo/grounding'
import {
  appendCompactionInventory,
  describeRemovedToolItem,
  diffRemovedSpans,
} from '../evidence/inventory'

import type { ContextCompactor } from '../context-compactor'
import type { LoopAgentStepsParams } from './types'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type {
  AgentState,
  CompactionBlockReason,
} from '@savant-code/common/types/session-state'

/** FID-2026-0821-001 P1-1: one-shot warning clears below trigger −10%. */
const WARNING_CLEAR_HYSTERESIS = 0.9

/**
 * FID-2026-0725-085: Run micro-compact before each API call to clear stale tool results.
 * This is zero-cost (no LLM call) and reduces context size incrementally.
 */
export function runMicroCompactPass(params: {
  agentState: AgentState
  contextCompactor: ContextCompactor
  loopParams: LoopAgentStepsParams
  logger: Logger
  thresholds: { autoCompact: number; reactiveCompact: number }
}): ReturnType<ContextCompactor['microCompact']> {
  const { agentState, contextCompactor, loopParams, logger, thresholds } =
    params
  // FID-2026-0818-007 step 5: the FID-boundary compaction checkpoint. When the
  // drive loop flagged a just-archived boundary and the context is over budget,
  // the boundary is the deterministic moment to run the L0 micro-compact pass —
  // over-budget is the trigger, the boundary is the checkpoint (never a forced
  // pass on a tiny FID). The flag is transient and cleared each step so it can
  // never go stale.
  const boundaryCompact = shouldBoundaryCompact({
    fidBoundaryDue: agentState.fidBoundaryDue === true,
    contextTokenCount: agentState.contextTokenCount,
    reactiveCompactThreshold: thresholds.reactiveCompact,
  })
  agentState.fidBoundaryDue = false
  const messagesBeforeMicroCompact = agentState.messageHistory.length
  // FID-2026-0814-004 H-05/H-06: the real token count feeds both the
  // config off-switch (microCompactEnabled inside the compactor) and the
  // pressure gate (below the floor → no clearing). The boundary checkpoint
  // runs the same zero-cost micro-compact; a boundary pass is logged distinctly
  // so a long drive's checkpoint compaction is visible in the transcript.
  // FID-2026-0824-027 post-closure amendment: PRE-history reference for the
  // identity diff below (micro-compact filters indices over the original
  // array, so kept messages keep object identity).
  const historyBeforeMicroCompactRef = agentState.messageHistory
  const microResult = contextCompactor.microCompact(
    agentState.messageHistory,
    agentState.contextTokenCount,
  )
  if (microResult.tokensSaved > 0) {
    // FID-2026-0802-005 L8: ContextCompactor now operates on Message[]
    // directly — the `as unknown as CompactionMessage[]` casts are gone.
    agentState.messageHistory = microResult.messages
    // FID-2026-0725-085: Log visible compaction summary.
    // Follows the Kilo Code / OpenClaude pattern: pause, output summary, proceed.
    const percentUsed = Math.round(
      (agentState.contextTokenCount / thresholds.autoCompact) * 100,
    )
    const boundaryLabel = boundaryCompact ? ' [FID boundary]' : ''
    logger.info(
      {
        messagesCleared:
          messagesBeforeMicroCompact - microResult.messages.length,
        tokensSaved: microResult.tokensSaved,
        percentUsed,
        fidBoundary: boundaryCompact,
      },
      `⚙️ Context micro-compacted${boundaryLabel}: cleared stale tool results, ~${microResult.tokensSaved.toLocaleString()} tokens saved. Context at ${percentUsed}% of auto-compact threshold.`,
    )
    // FID-2026-0824-027: inventory row + metrics increment (fail-open).
    // FID-2026-0824-025/-027 post-closure amendment: region indices + bounded
    // per-item rows derived by identity diff at this boundary.
    const removalDiff = diffRemovedSpans({
      prev: historyBeforeMicroCompactRef,
      next: microResult.messages,
      describeItem: describeRemovedToolItem,
    })
    void appendCompactionInventory({
      projectRoot: loopParams.fileContext?.projectRoot ?? '',
      runId: agentState.runId ?? agentState.agentId,
      layer: 'micro',
      removedMessages: messagesBeforeMicroCompact - microResult.messages.length,
      tokensSaved: microResult.tokensSaved,
      percentUsed,
      regions: removalDiff.regions,
      items: removalDiff.items,
    })
    const microMetrics = agentState.compactionMetrics ?? {
      events: 0,
      tokensSaved: 0,
    }
    agentState.compactionMetrics = {
      events: microMetrics.events + 1,
      tokensSaved: microMetrics.tokensSaved + microResult.tokensSaved,
    }
    if (!agentState.parentId) {
      appendGroundingRefresh(
        agentState,
        getOrCreateEnforcement(agentState).recordCompaction().refreshText,
      )
    }
  }
  return microResult
}

/**
 * FID-2026-0725-085: Check auto-compact threshold + the status resolution
 * below it. Mutates agentState compaction fields; returns the computed
 * window percentage for the parent's emit step.
 */
export function resolveCompactionStatus(params: {
  agentState: AgentState
  contextCompactor: ContextCompactor
  logger: Logger
  thresholds: { autoCompact: number; reactiveCompact: number }
  autoCompactCheck: ReturnType<ContextCompactor['shouldAutoCompact']>
  microResult: ReturnType<ContextCompactor['microCompact']>
}): number {
  const {
    agentState,
    contextCompactor,
    logger,
    thresholds,
    autoCompactCheck,
    microResult,
  } = params
  // FID-2026-0725-085: Check auto-compact threshold.
  // If context exceeds threshold, emit warning and log for diagnostics.
  // Full LLM summarization is handled by handleSteps context-pruner spawn.
  if (autoCompactCheck.shouldCompact) {
    if (!agentState.parentId) {
      appendGroundingRefresh(
        agentState,
        getOrCreateEnforcement(agentState).recordCompaction().refreshText,
      )
    }
    const degradationWarning = contextCompactor.getDegradationWarning()
    if (degradationWarning) {
      logger.warn(
        { contextTokenCount: agentState.contextTokenCount },
        degradationWarning,
      )
    } else {
      logger.warn(
        {
          contextTokenCount: agentState.contextTokenCount,
          threshold: thresholds.autoCompact,
        },
        `⚠️ Context approaching auto-compact threshold (${agentState.contextTokenCount.toLocaleString()} / ${thresholds.autoCompact.toLocaleString()} tokens). Full summarization will trigger via context-pruner.`,
      )
    }
  }

  // FID-2026-0814-001: the sidebar percent is window-relative — the same
  // denominator the pruner trigger uses (maxContextLength = reactiveCompact =
  // contextWindow), so "N% of window" lines up with the Context row and the
  // pruner trigger instead of the hidden internal auto-compact threshold.
  // FID-2026-0814-012: read reactiveCompact directly (single source of truth).
  const windowTokens = thresholds.reactiveCompact
  const percentOfWindow = Math.round(
    (agentState.contextTokenCount / windowTokens) * 100,
  )
  // FID-2026-0814-011: single trigger authority. Record the proven
  // shouldAutoCompact verdict on agentState so the serialized savant
  // handleSteps consumes THIS signal (instead of independently re-deriving
  // from maxContextLength, which can diverge). Set unconditionally each step
  // so a below-threshold step clears the flag — it can never go stale.
  agentState.autoCompactDue = autoCompactCheck.shouldCompact

  // FID-2026-0813-023: surface live compaction status to the read-only CLI
  // sidebar row. The heartbeat reads this off the snapshot's mainAgentState.
  // FID-2026-0821-001 P0-1: consume the previously-dropped `.reason`. At or
  // above the trigger with shouldCompact=false, the only runtime cause is a
  // blocking breaker — surface WHY instead of silently skipping (the hermes
  // #62625 pattern). Cleared on any non-blocked step so it can never go
  // stale. P1-1: the one-shot warning stamp clears below trigger −10%.
  const atOrAboveTrigger =
    agentState.contextTokenCount >= thresholds.autoCompact
  if (!autoCompactCheck.shouldCompact && atOrAboveTrigger) {
    const breaker = contextCompactor.describeBreaker()
    const blockReason: CompactionBlockReason = breaker.blocking
      ? 'circuit-breaker-open'
      : 'compaction-disabled'
    agentState.compactionBlock = { reason: blockReason }
    if (!agentState.contextWarningIssuedAt) {
      agentState.contextWarningIssuedAt = Date.now()
    }
    agentState.compactionStatus = {
      phase: 'blocked',
      percentUsed: percentOfWindow,
      blockReason,
    }
    logger.warn(
      {
        contextTokenCount: agentState.contextTokenCount,
        threshold: thresholds.autoCompact,
        reason: blockReason,
      },
      `⚠️ Auto-compact BLOCKED at ${percentOfWindow}% of window (${blockReason})`,
    )
  } else {
    agentState.compactionBlock = undefined
    if (autoCompactCheck.shouldCompact) {
      if (!agentState.contextWarningIssuedAt) {
        agentState.contextWarningIssuedAt = Date.now()
      }
      agentState.compactionStatus = {
        phase: 'warning',
        percentUsed: percentOfWindow,
      }
    } else {
      if (
        agentState.contextWarningIssuedAt !== undefined &&
        agentState.contextTokenCount <
          thresholds.autoCompact * WARNING_CLEAR_HYSTERESIS
      ) {
        agentState.contextWarningIssuedAt = undefined
      }
      if (microResult.tokensSaved > 0) {
        agentState.compactionStatus = {
          phase: 'compacted',
          tokensSaved: microResult.tokensSaved,
          percentUsed: percentOfWindow,
        }
      } else {
        agentState.compactionStatus = {
          phase: 'idle',
          percentUsed: percentOfWindow,
        }
      }
    }
  }
  return percentOfWindow
}

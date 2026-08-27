import { shouldUseLocalTokenCount } from '@savant-code/common/constants/free-agents'
import { buildArray } from '@savant-code/common/util/array'
import { userMessage } from '@savant-code/common/util/messages'

import { shouldBoundaryCompact } from './auto-drive-driver'
import { reconcileTokenCount } from './reconcile-token-count'
import { getOrCreateEnforcement } from '../echo/enforcement'
import { appendGroundingRefresh } from '../echo/grounding'
import {
  appendCompactionInventory,
  describeRemovedToolItem,
  diffRemovedSpans,
} from '../evidence/inventory'
import { callTokenCountAPI } from '../llm-api/savant-code-web-api'
import { getAgentPrompt } from '../templates/strings'
import {
  countTokens,
  countTokensJsonCached,
  countTokensMessagesCached,
} from '../util/token-counter'

import type { ContextCompactor } from '../context-compactor'
import type { LoopAgentStepsParams } from './types'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'
import type { PrintModeCompactionStatus } from '@savant-code/common/types/print-mode'
import type {
  AgentState,
  CompactionBlockReason,
} from '@savant-code/common/types/session-state'
import type { CustomToolDefinitions } from '@savant-code/common/util/file'

/** FID-2026-0821-001 P1-1: one-shot warning clears below trigger −10%. */
const WARNING_CLEAR_HYSTERESIS = 0.9
const lastEmittedCompactionStatus = new WeakMap<AgentState, string>()

function emitCompactionStatus(
  agentState: AgentState,
  onResponseChunk: (chunk: string | PrintModeCompactionStatus) => void,
): void {
  const status = agentState.compactionStatus
  if (!status) return
  const key = JSON.stringify(status)
  if (lastEmittedCompactionStatus.get(agentState) === key) return
  lastEmittedCompactionStatus.set(agentState, key)
  onResponseChunk({ type: 'compaction_status', ...status })
}

/**
 * Computes the step prompt once per step and updates the agent state's
 * context token count (web API for SavantCode-hosted paid runs, local
 * estimation otherwise), then runs the zero-cost micro-compact and logs the
 * auto-compact threshold check. Behavior identical to the inline loop block.
 */
export async function prepareStepContext(params: {
  loopParams: LoopAgentStepsParams
  agentTemplate: AgentTemplate
  agentState: AgentState
  system: string
  toolsForTokenCount: Array<{
    name: string
    description?: string
    input_schema?: JSONValue
  }>
  contextCompactor: ContextCompactor
  logger: Logger
  additionalToolDefinitionsWithCache: () => Promise<CustomToolDefinitions>
}): Promise<{ stepPrompt: string | undefined; systemTokens: number }> {
  const {
    loopParams,
    agentTemplate,
    agentState,
    system,
    toolsForTokenCount,
    contextCompactor,
    logger,
    additionalToolDefinitionsWithCache,
  } = params

  // FID-2026-0802-005 L15: computed once per step and reused by
  // runAgentStep. Note: this runs before the programmatic step, so a
  // handleSteps generator that mutates history (e.g. set_messages) could
  // in theory make the USER_INPUT_PROMPT placeholder stale — no bundled
  // agent does this; acceptable per the FID.
  const stepPrompt = await getAgentPrompt({
    ...loopParams,
    agentTemplate,
    promptType: { type: 'stepPrompt' },
    fileContext: loopParams.fileContext,
    agentState,
    agentTemplates: loopParams.localAgentTemplates,
    logger,
    additionalToolDefinitions: additionalToolDefinitionsWithCache,
  })
  // FID-2026-0815-011 E-01: the system prompt is session-invariant, so its
  // token count is computed once here and reused by runAgentStep (which
  // otherwise tokenizes it again every step).
  const systemTokens = countTokens(system)

  // Count structured message content (not JSON.stringify, which inflates the
  // count and counts image base64 as text); system is a plain string; tool
  // schemas stay JSON since that's roughly how the model sees them.
  // FID-2026-0802-005 H2: countTokensMessagesCached memoizes per-message
  // counts by object identity, so the history is tokenized once over the
  // whole run instead of re-encoded every step (O(n²) → O(n)). The step
  // prompt is counted directly instead of rebuilding the array (saves the
  // per-step copy too).
  const estimateContextTokensLocally = () =>
    countTokensMessagesCached(agentState.messageHistory) +
    countTokens(stepPrompt ?? '') +
    systemTokens +
    countTokensJsonCached(toolsForTokenCount)

  // Use local token estimation for external runs (OpenCode Go, BYOK,
  // savant-free) where the SavantCode web API is unavailable or unnecessary.
  // The external API ships the full message history + tools via HTTP on every
  // step, adding serial network overhead (30s timeout × 3 retries). Local
  // estimation uses gpt-tokenizer with a 1.35× fudge factor — fast and
  // accurate enough for context management. Only SavantCode-hosted paid runs
  // need the accurate API count for credit billing.
  const hasSavantCodeBackend = Boolean(
    loopParams.apiKey ?? loopParams.ciEnv.SAVANT_CODE_API_KEY,
  )
  if (
    shouldUseLocalTokenCount({
      agentId: agentTemplate.id,
      model: agentTemplate.model,
      hasSavantCodeBackend,
    })
  ) {
    agentState.contextTokenCount = estimateContextTokensLocally()
  } else {
    // SavantCode-hosted paid run: use the accurate web API count.
    // FID-2026-0815-013 E-01: build the full message+step-prompt array only
    // here — the local-estimation path above never consumes it, so the eager
    // O(history) recursive copy used to run (and be discarded) every step.
    const messagesWithStepPrompt = buildArray(
      ...agentState.messageHistory,
      stepPrompt &&
        userMessage({
          content: stepPrompt,
        }),
    )
    const tokenCountResult = await callTokenCountAPI({
      messages: messagesWithStepPrompt as JSONValue[],
      system,
      model: agentTemplate.model,
      tools: toolsForTokenCount as Array<{
        name: string
        description?: string
        input_schema?: JSONValue
      }>,
      fetch,
      logger,
      env: { clientEnv: loopParams.clientEnv, ciEnv: loopParams.ciEnv },
      apiKey: loopParams.apiKey,
    })
    if (tokenCountResult.inputTokens !== undefined) {
      agentState.contextTokenCount = tokenCountResult.inputTokens
      // FID-2026-0821-001 P2-1: the endpoint count is provider-grade —
      // stamp it so the reconcile entry point sees freshest-known truth.
      agentState.lastProviderUsage = {
        inputTokens: tokenCountResult.inputTokens,
        capturedAt: Date.now(),
      }
    } else if (tokenCountResult.error) {
      logger.warn(
        { error: tokenCountResult.error },
        'Failed to get token count from web API — falling back to local estimation',
      )
      agentState.contextTokenCount = estimateContextTokensLocally()
    }
  }

  // FID-2026-0821-001 P2-1: single precedence owner — fresh provider usage
  // overrides the estimator; stale usage (post-prune) loses to the fresher
  // lastPrunerCompletionAt stamp, so the spawn-boundary recount stands.
  // Hosted runs stamp the endpoint count as usage too, so both modes
  // converge through this one entry point.
  // FID-2026-0821-003-A: pass the step logger so each reconcile decision is
  // visible (chosen source + inputs) — the observability channel for the
  // estimator↔truth alternation.
  agentState.contextTokenCount = reconcileTokenCount({
    agentState,
    localEstimate: agentState.contextTokenCount,
    logger,
  })

  // P3b (FID-2026-0806-003): score any compaction that ran during the
  // PREVIOUS step against the real post-response token count just computed
  // above (web API for hosted runs, local estimate otherwise). Must run
  // BEFORE the fresh shouldAutoCompact preflight below so the preflight arms
  // a new score instead of re-judging the old one. No-op when nothing was
  // armed (Hermes anti-thrash guard).
  contextCompactor.scoreCompactionEffectiveness(agentState.contextTokenCount)

  // FID-2026-0725-085: Run micro-compact before each API call to clear stale tool results.
  // This is zero-cost (no LLM call) and reduces context size incrementally.
  const thresholds = contextCompactor.getThresholds()
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

  // FID-2026-0725-085: Check auto-compact threshold.
  // If context exceeds threshold, emit warning and log for diagnostics.
  // Full LLM summarization is handled by handleSteps context-pruner spawn.
  const autoCompactCheck = contextCompactor.shouldAutoCompact(
    agentState.messageHistory,
    agentState.contextTokenCount,
  )
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

  emitCompactionStatus(agentState, loopParams.onResponseChunk)
  return { stepPrompt, systemTokens }
}

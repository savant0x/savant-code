/**
 * Telemetry builders for the context-pruner handleSteps generator (extracted
 * from main.ts — FID-2026-0809-015 Batch A). Embedded into the serialized
 * scope via `.toString()` in handle-steps.ts; they reference only params,
 * literals, and baked constants (CONTEXT_PRUNING_COMPLETED_EVENT,
 * CHARS_PER_TOKEN). Each function wraps its logger call in try/catch so
 * telemetry is always best-effort.
 */
import { CHARS_PER_TOKEN, CONTEXT_PRUNING_COMPLETED_EVENT } from './constants'

import type { AgentState } from '../types/agent-definition'
import type { Logger } from '../types/util-types'

export type FoldTelemetryContext = {
  agentState: AgentState
  maxContextLength: number
  cacheExpiryMs: number
  previousSummaryEntryCount: number
  userBudget: number
  assistantToolBudget: number
  keepRecentTokens: number
  forceCompact: boolean
  isMidTurnPrune: boolean
  liveUserPromptFound: boolean
}

/** Shared fold-path base payload (spread into the per-branch loggers). */
export function buildFoldTelemetryBase(
  ctx: FoldTelemetryContext,
): Record<string, unknown> {
  return {
    axiomEvent: CONTEXT_PRUNING_COMPLETED_EVENT,
    agent_run_id: ctx.agentState.runId ?? null,
    parent_agent_run_id: ctx.agentState.parentId ?? null,
    trigger_reason: 'amortized_fold',
    context_token_count: ctx.agentState.contextTokenCount,
    max_context_length: ctx.maxContextLength,
    cache_expiry_ms: ctx.cacheExpiryMs,
    previous_summary_entry_count: ctx.previousSummaryEntryCount,
    user_budget: ctx.userBudget,
    assistant_tool_budget: ctx.assistantToolBudget,
    fixed_tail_budget_tokens: ctx.keepRecentTokens,
    fold_oldest_exchange: true,
    force_compact: ctx.forceCompact,
    mid_turn: ctx.isMidTurnPrune,
    live_user_prompt_found: ctx.liveUserPromptFound,
    compaction_summary_tagged: true,
  }
}

export function logFoldNoop(
  logger: Logger,
  base: Record<string, unknown>,
  remainingMessageCount: number,
): void {
  try {
    logger.info(
      {
        ...base,
        folded_exchange_message_count: 0,
        remaining_message_count: remainingMessageCount,
        summary_estimated_tokens: 0,
        fold_noop_reason: 'no_unabsorbed_exchange',
      },
      'Context pruning fold: nothing to fold',
    )
  } catch {
    // best-effort
  }
}

export function logFoldCompleted(
  logger: Logger,
  base: Record<string, unknown>,
  fields: {
    foldedExchangeMessageCount: number
    remainingMessageCount: number
    firstUserTurnPinned: boolean
    structuredBlockChars: number
    preservedStateJsonChars: number
    newestEntryForced: boolean
    taggedSummaryText: string
  },
): void {
  try {
    logger.info(
      {
        ...base,
        folded_exchange_message_count: fields.foldedExchangeMessageCount,
        remaining_message_count: fields.remainingMessageCount,
        first_user_turn_pinned: fields.firstUserTurnPinned,
        structured_state_block_chars: fields.structuredBlockChars,
        preserved_state_json_chars: fields.preservedStateJsonChars,
        newest_entry_forced: fields.newestEntryForced,
        summary_estimated_tokens: Math.ceil(
          fields.taggedSummaryText.length / CHARS_PER_TOKEN,
        ),
      },
      'Context pruning fold: amortized exchange folded',
    )
  } catch {
    // best-effort
  }
}

export function logPostCompact(
  logger: Logger,
  ctx: {
    agentState: AgentState
    compressedTokens: number
    summaryPreview: string
  },
): void {
  try {
    logger.info(
      {
        axiomEvent: 'context_compaction.post_compact',
        original_tokens: ctx.agentState.contextTokenCount,
        compressed_tokens: ctx.compressedTokens,
        compression_ratio:
          ctx.agentState.contextTokenCount > 0
            ? Math.min(
                1,
                Math.max(
                  0,
                  (ctx.agentState.contextTokenCount - ctx.compressedTokens) /
                    ctx.agentState.contextTokenCount,
                ),
              )
            : 0,
        summary_preview: ctx.summaryPreview.slice(0, 200),
        session_id: ctx.agentState.runId ?? null,
      },
      'PostCompact: context compaction completed (pruner)',
    )
  } catch {
    // best-effort
  }
}

export function logCompletion(
  logger: Logger,
  fields: {
    agentState: AgentState
    triggerReason: string
    maxContextLength: number
    cacheGapMs: number | null
    cacheExpiryMs: number
    previousSummaryEntryCount: number
    userBudget: number
    userEntryCount: number
    droppedUserEntryCount: number
    assistantToolBudget: number
    assistantToolEntryCount: number
    droppedAssistantToolEntryCount: number
    isMidTurnPrune: boolean
    liveUserPromptFound: boolean
    liveUserPromptTextPreserved: boolean
    newestEntryForced: boolean
    firstUserTurnPinned: boolean
    structuredBlockChars: number
    preservedStateJsonChars: number
    keepRecentTokens: number
    forceCompact: boolean
    taggedSummaryText: string
  },
): void {
  try {
    logger.info(
      {
        axiomEvent: CONTEXT_PRUNING_COMPLETED_EVENT,
        agent_run_id: fields.agentState.runId ?? null,
        parent_agent_run_id: fields.agentState.parentId ?? null,
        trigger_reason: fields.triggerReason,
        context_token_count: fields.agentState.contextTokenCount,
        max_context_length: fields.maxContextLength,
        ...(fields.cacheGapMs === null
          ? {}
          : { cache_gap_ms: fields.cacheGapMs }),
        cache_expiry_ms: fields.cacheExpiryMs,
        previous_summary_entry_count: fields.previousSummaryEntryCount,
        user_budget: fields.userBudget,
        user_entry_count: fields.userEntryCount,
        dropped_user_entry_count: fields.droppedUserEntryCount,
        assistant_tool_budget: fields.assistantToolBudget,
        assistant_tool_entry_count: fields.assistantToolEntryCount,
        dropped_assistant_tool_entry_count:
          fields.droppedAssistantToolEntryCount,
        mid_turn: fields.isMidTurnPrune,
        live_user_prompt_found: fields.liveUserPromptFound,
        live_user_prompt_text_preserved: fields.liveUserPromptTextPreserved,
        newest_entry_forced: fields.newestEntryForced,
        first_user_turn_pinned: fields.firstUserTurnPinned,
        structured_state_block_chars: fields.structuredBlockChars,
        preserved_state_json_chars: fields.preservedStateJsonChars,
        fixed_tail_budget_tokens: fields.keepRecentTokens,
        compaction_summary_tagged: true,
        force_compact: fields.forceCompact,
        summary_estimated_tokens: Math.ceil(
          fields.taggedSummaryText.length / CHARS_PER_TOKEN,
        ),
      },
      'Context pruning completed',
    )
  } catch {
    // Ignore logging failures; set_messages below is the critical operation.
  }
}

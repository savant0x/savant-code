/**
 * Main orchestration for the context-pruner handleSteps generator (extracted
 * verbatim from the original in-body implementation; delegates summarization phases to serializable extracted modules.
 * Embedded via .toString() at factory time; the constants/helpers it
 * references are baked/embedded into the same generated scope.
 */
import { CHARS_PER_TOKEN, TOKEN_COUNT_FUDGE_FACTOR } from './constants'
import { runFoldOldestExchange } from './fold-exchange'
import { asNumber, getTextContent } from './helpers'
import { runMinimalSurgery } from './minimal-surgery'
import { preparePruneContext } from './prepare-prune-context'
import { buildSummarizationContext } from './summarization-context'
import { buildFullSummary } from './summary-assembly'
import { logCompletion, logPostCompact } from './telemetry'

import type { AgentState, ToolCall } from '../types/agent-definition'
import type { JSONValue, Logger, Message } from '../types/util-types'

export function* runContextPrunerMain(
  agentState: AgentState,
  params: Record<string, JSONValue> | undefined,
  logger: Logger,
) {
  const p = params ?? {}

  /** Prompt cache expiry time (Anthropic caches for 5 minutes by default) */
  const CACHE_EXPIRY_MS: number = asNumber(p.cacheExpiryMs) ?? 5 * 60 * 1000

  const maxContextLength: number = asNumber(p.maxContextLength) ?? 200_000

  // Loop 141: STEP 0 tag-strip + cache-miss probe extracted to
  // preparePruneContext (embedded via handle-steps.ts).
  const prepared = preparePruneContext({
    agentState,
    params,
    cacheExpiryMs: CACHE_EXPIRY_MS,
  })
  let currentMessages = prepared.currentMessages
  const { cacheWillMiss, cacheGapMs } = prepared

  const contextLimitExceeded =
    agentState.contextTokenCount + TOKEN_COUNT_FUDGE_FACTOR > maxContextLength

  // P3a: amortized fold mode folds one oldest un-absorbed exchange and keeps
  // everything else verbatim (Hermes micro-compaction; opt-in by the trigger).
  const foldOldestExchange: boolean = p.foldOldestExchange === true
  // P3d: force ratio — proceed even for low-value folds rather than risking
  // a hard overflow. Bypasses the cache-will-miss/context-limit gates below.
  const forceCompact: boolean = p.force === true

  // Check if we need to prune at all:
  // - Prune when context exceeds max, OR
  // - Prune when prompt cache will miss (>5 min gap) to take advantage of fresh context
  // - P3a/P3d: an explicit fold or force request always proceeds.
  // If not, return messages with just the subagent-specific tags removed
  if (
    !contextLimitExceeded &&
    !cacheWillMiss &&
    !foldOldestExchange &&
    !forceCompact
  ) {
    yield {
      toolName: 'set_messages',
      input: { messages: currentMessages },
      includeToolCall: false,
    }
    return
  }

  // === SUMMARIZATION MODE ===
  // Find and extract the last remaining INSTRUCTIONS_PROMPT message (for the parent agent)
  // to be preserved as the second message after the summary
  let instructionsPromptMessage: Message | null = null
  const lastRemainingInstructionsIndex = currentMessages.findLastIndex(
    (message) => message.tags?.includes('INSTRUCTIONS_PROMPT'),
  )
  if (lastRemainingInstructionsIndex !== -1) {
    instructionsPromptMessage = currentMessages[lastRemainingInstructionsIndex]
    currentMessages.splice(lastRemainingInstructionsIndex, 1)
  }

  // Loop 141: summarization-parameter preparation extracted to
  // buildSummarizationContext (embedded via handle-steps.ts).
  const {
    assistantToolBudget,
    userBudget,
    keepRecentTokens,
    digestCaps,
    previousSummaryContent,
    previousSummaryEntries,
    latestLiveUserPromptIndex,
    latestLiveUserPromptMessage,
    isMidTurnPrune,
  } = buildSummarizationContext({ currentMessages, params: p })

  // Loop 141: minimal-surgery fold loop extracted to runMinimalSurgery
  // (embedded via handle-steps.ts). Returns the possibly-reduced messages and
  // whether it already emitted the early-return set_messages.
  const surgery = runMinimalSurgery({
    agentState,
    assistantToolBudget,
    cacheExpiryMs: CACHE_EXPIRY_MS,
    contextTokenCount: agentState.contextTokenCount,
    currentMessages,
    forceCompact,
    foldOldestExchange,
    instructionsPromptMessage,
    isMidTurnPrune,
    keepRecentTokens,
    latestLiveUserPromptMessage,
    logger,
    maxContextLength,
    previousSummaryContent,
    previousSummaryEntries,
    userBudget,
  })
  currentMessages = surgery.currentMessages
  if (surgery.earlyReturn) {
    yield {
      toolName: 'set_messages',
      input: { messages: currentMessages },
      includeToolCall: false,
    }
    return
  }
  if (foldOldestExchange) {
    yield runFoldOldestExchange({
      agentState,
      assistantToolBudget,
      cacheExpiryMs: CACHE_EXPIRY_MS,
      currentMessages,
      forceCompact,
      instructionsPromptMessage,
      isMidTurnPrune,
      keepRecentTokens,
      latestLiveUserPromptMessage,
      logger,
      maxContextLength,
      previousSummaryContent,
      previousSummaryEntries,
      userBudget,
    })
    return
  }

  const {
    allEntries,
    firstUserTurnPinned,
    finalMessages,
    includedEntries,
    liveUserPromptEntry,
    newestEntryForced,
    preservedStateJson,
    structuredBlock,
    structuredSummaryText,
    taggedSummaryText,
  } = buildFullSummary({
    assistantToolBudget,
    digestCaps,
    currentMessages,
    instructionsPromptMessage,
    isMidTurnPrune,
    keepRecentTokens,
    latestLiveUserPromptIndex,
    latestLiveUserPromptMessage,
    previousSummaryContent,
    previousSummaryEntries,
    userBudget,
  })

  const userEntryCount = allEntries.filter(
    (entry) => entry.role === 'user',
  ).length
  const assistantToolEntryCount = allEntries.length - userEntryCount
  const liveUserPromptHasText = latestLiveUserPromptMessage
    ? getTextContent(latestLiveUserPromptMessage).trim().length > 0
    : false
  const liveUserPromptTextPreserved = latestLiveUserPromptMessage
    ? !isMidTurnPrune ||
      !liveUserPromptHasText ||
      (liveUserPromptEntry !== undefined &&
        includedEntries.includes(liveUserPromptEntry))
    : false
  const includedUserEntryCount = includedEntries.filter(
    (entry) => entry.role === 'user',
  ).length
  const includedAssistantToolEntryCount =
    includedEntries.length - includedUserEntryCount
  const triggerReason = contextLimitExceeded
    ? cacheWillMiss
      ? 'context_limit_and_cache_expiry'
      : 'context_limit'
    : 'cache_expiry'

  // P4c (FID-2026-0806-003): PostCompact event with ratio metrics (Axon
  // pattern) — the proactive-pruner counterpart to the reactive emit in
  // loop.ts. Best-effort; never blocks set_messages.
  const prunerSummaryTokens = Math.ceil(
    taggedSummaryText.length / CHARS_PER_TOKEN,
  )
  logPostCompact(logger, {
    agentState,
    compressedTokens: prunerSummaryTokens,
    summaryPreview: structuredSummaryText,
  })

  // Telemetry is best-effort and must never block the actual pruning update.
  logCompletion(logger, {
    agentState,
    triggerReason,
    maxContextLength,
    cacheGapMs,
    cacheExpiryMs: CACHE_EXPIRY_MS,
    previousSummaryEntryCount: previousSummaryEntries.length,
    userBudget,
    userEntryCount,
    droppedUserEntryCount: userEntryCount - includedUserEntryCount,
    assistantToolBudget,
    assistantToolEntryCount,
    droppedAssistantToolEntryCount:
      assistantToolEntryCount - includedAssistantToolEntryCount,
    isMidTurnPrune,
    liveUserPromptFound: latestLiveUserPromptMessage !== null,
    liveUserPromptTextPreserved,
    newestEntryForced,
    firstUserTurnPinned,
    structuredBlockChars: structuredBlock.length,
    preservedStateJsonChars: preservedStateJson.length,
    keepRecentTokens,
    forceCompact,
    taggedSummaryText,
  })

  yield {
    toolName: 'set_messages',
    input: {
      messages: finalMessages,
    },
    includeToolCall: false,
  } satisfies ToolCall<'set_messages'>
}

/**
 * Main orchestration for the context-pruner handleSteps generator (extracted
 * verbatim from the original in-body implementation; delegates summarization phases to serializable extracted modules.
 * Embedded via .toString() at factory time; the constants/helpers it
 * references are baked/embedded into the same generated scope.
 */
import {
  planFoldsToReachTarget,
  segmentExchanges,
  tokensForRange,
} from './budget'
import {
  ASSISTANT_TOOL_BUDGET,
  CHARS_PER_TOKEN,
  COMPACTION_PROTECTED_TAIL_TURNS,
  COMPACTION_SUMMARY_ALLOWANCE_TOKENS,
  FIXED_TAIL_BUDGET_TOKENS,
  TOKEN_COUNT_FUDGE_FACTOR,
  USER_BUDGET,
} from './constants'
import { runFoldOldestExchange } from './fold-exchange'
import { asNumber, getTextContent } from './helpers'
import { buildFullSummary } from './summary-assembly'
import {
  extractSummaryContent,
  isConversationSummary,
  parseSummaryIntoEntries,
  shouldExcludeMessage,
} from './summary-parsing'
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

  const messages = agentState.messageHistory
  const maxContextLength: number = asNumber(p.maxContextLength) ?? 200_000

  // STEP 0: Always remove the last INSTRUCTIONS_PROMPT and SUBAGENT_SPAWN
  // (these are inserted for the context-pruner subagent itself)
  let currentMessages = [...messages]
  const lastInstructionsPromptIndex = currentMessages.findLastIndex((message) =>
    message.tags?.includes('INSTRUCTIONS_PROMPT'),
  )
  if (lastInstructionsPromptIndex !== -1) {
    currentMessages.splice(lastInstructionsPromptIndex, 1)
  }
  const lastSubagentSpawnIndex = currentMessages.findLastIndex((message) =>
    message.tags?.includes('SUBAGENT_SPAWN'),
  )
  if (lastSubagentSpawnIndex !== -1) {
    currentMessages.splice(lastSubagentSpawnIndex, 1)
  }

  // Also remove the params USER_PROMPT if params were provided to this agent
  // (this is the message like <user_message>{"cacheExpiryMs": 600000}</user_message>)
  if (params && Object.keys(params).length > 0) {
    const lastUserPromptIndex = currentMessages.findLastIndex((message) =>
      message.tags?.includes('USER_PROMPT'),
    )
    if (lastUserPromptIndex !== -1) {
      currentMessages.splice(lastUserPromptIndex, 1)
    }
  }

  // Check for prompt cache miss (>5 min gap before the USER_PROMPT message)
  // The USER_PROMPT is the actual user message; INSTRUCTIONS_PROMPT comes after it
  // We need to find the USER_PROMPT and check the gap between it and the last assistant message
  let cacheWillMiss = false
  let cacheGapMs: number | null = null
  const userPromptIndex = currentMessages.findLastIndex((message) =>
    message.tags?.includes('USER_PROMPT'),
  )
  if (userPromptIndex > 0) {
    const userPromptMsg = currentMessages[userPromptIndex]
    // Find the last assistant message before USER_PROMPT (tool messages don't have sentAt)
    let lastAssistantMsg: Message | undefined
    for (let i = userPromptIndex - 1; i >= 0; i--) {
      if (currentMessages[i].role === 'assistant') {
        lastAssistantMsg = currentMessages[i]
        break
      }
    }
    if (
      userPromptMsg !== undefined &&
      typeof userPromptMsg.sentAt === 'number' &&
      lastAssistantMsg !== undefined &&
      typeof lastAssistantMsg.sentAt === 'number'
    ) {
      const gap = userPromptMsg.sentAt - lastAssistantMsg.sentAt
      cacheGapMs = gap
      cacheWillMiss = gap > CACHE_EXPIRY_MS
    }
  }

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

  // === SUMMARIZATION STRATEGY ===
  // 1. Summarize ALL messages (apply transformations: truncation, tool summaries, etc.)
  // 2. Walk backwards through summarized parts to apply token budgets
  // 3. Older summarized parts beyond the budgets are dropped

  const assistantToolBudget: number =
    asNumber(p.assistantToolBudget) ?? ASSISTANT_TOOL_BUDGET
  const userBudget: number = asNumber(p.userBudget) ?? USER_BUDGET
  // P2a: fixed verbatim recent-tail token budget (DeepSeek 16 384 default).
  const keepRecentTokens: number =
    asNumber(p.keepRecentTokens) ?? FIXED_TAIL_BUDGET_TOKENS
  // FID-2026-0824-024 post-closure amendment: operator-configured digest
  // caps injected via spawn params override the baked defaults. Forwarded to
  // the full-sweep summarizer; the fold path keeps baked defaults.
  const digestHeadCharsParam = asNumber(p.digestHeadChars) ?? undefined
  const digestTailCharsParam = asNumber(p.digestTailChars) ?? undefined
  const digestCaps =
    digestHeadCharsParam !== undefined || digestTailCharsParam !== undefined
      ? {
          ...(digestHeadCharsParam !== undefined
            ? { headChars: digestHeadCharsParam }
            : {}),
          ...(digestTailCharsParam !== undefined
            ? { tailChars: digestTailCharsParam }
            : {}),
        }
      : undefined

  // Extract previous summary content from all messages
  let previousSummaryContent = ''
  for (const message of currentMessages) {
    if (isConversationSummary(message)) {
      previousSummaryContent = extractSummaryContent(message)
    }
  }

  // Parse the previous summary into role-tagged entries up front — both the
  // full path and the P3a fold path merge them with new entries (Continue
  // re-distill rule).
  const previousSummaryEntries = parseSummaryIntoEntries(previousSummaryContent)

  // If pruning happens before the assistant has started responding to the
  // current user prompt, preserve that prompt as a real message after the
  // memory artifact. If pruning happens mid-turn, keep the prompt in the
  // historical memory with the assistant/tool progress that followed it and
  // append a synthetic continuation prompt instead.
  const latestLiveUserPromptIndex = currentMessages.findLastIndex((message) =>
    message.tags?.includes('USER_PROMPT'),
  )
  const latestLiveUserPromptMessage =
    latestLiveUserPromptIndex !== -1
      ? currentMessages[latestLiveUserPromptIndex]
      : null
  const isMidTurnPrune =
    latestLiveUserPromptIndex !== -1 &&
    currentMessages
      .slice(latestLiveUserPromptIndex + 1)
      .some(
        (message) =>
          !shouldExcludeMessage(message) && !isConversationSummary(message),
      )

  // FID-2026-0824-025: minimal surgery — fold oldest exchanges until the
  // projected total reaches the window target (hermes accumulate-until-
  // target). Protected head keeps early framing; last N exchanges stay
  // verbatim. Falls back to the full sweep below when folds cannot reach
  // the target (degradation, not failure).
  let surgeryMessages = currentMessages
  if (!forceCompact && !foldOldestExchange) {
    const segments = segmentExchanges(currentMessages)
    const estimates = segments.map((segment) =>
      tokensForRange(currentMessages, segment.start, segment.end),
    )
    const totalEstimate = estimates.reduce((sum, count) => sum + count, 0)
    const plan = planFoldsToReachTarget({
      exchangeTokenEstimates: estimates,
      totalTokens: Math.max(totalEstimate, agentState.contextTokenCount),
      targetTokens: maxContextLength,
      summaryAllowanceTokens: COMPACTION_SUMMARY_ALLOWANCE_TOKENS,
      protectedHeadSegments: 1,
      protectedTailSegments: COMPACTION_PROTECTED_TAIL_TURNS,
    })
    let foldsDone = 0
    for (let foldIndex = 0; foldIndex < plan.folds; foldIndex++) {
      const foldedCall = runFoldOldestExchange({
        agentState,
        assistantToolBudget,
        cacheExpiryMs: CACHE_EXPIRY_MS,
        currentMessages: surgeryMessages,
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
      const nextMessages = foldedCall.input.messages
      if (nextMessages.length >= surgeryMessages.length) break
      surgeryMessages = nextMessages
      foldsDone += 1
    }
    if (foldsDone > 0) {
      const recounted = tokensForRange(
        surgeryMessages,
        0,
        surgeryMessages.length,
      )
      currentMessages = surgeryMessages
      if (recounted <= maxContextLength) {
        yield {
          toolName: 'set_messages',
          input: { messages: currentMessages },
          includeToolCall: false,
        }
        return
      }
    }
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

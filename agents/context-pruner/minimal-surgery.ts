// FID-2026-0819-005 Loop 141: minimal-surgery fold loop, extracted from
// main.ts (FID-2026-0824-025 — fold oldest exchanges until the projected
// total reaches the window target; hermes accumulate-until-target).
// Registered in handle-steps.ts embeddedHelpers so the serialized generator
// scope resolves it. Behavior contract: returns the possibly-reduced
// messages plus earlyReturn — true when the fold pass reached the target
// and the caller must emit the terminal set_messages and stop (degradation
// to the full sweep otherwise, not a failure).

import {
  planFoldsToReachTarget,
  segmentExchanges,
  tokensForRange,
} from './budget'
import {
  COMPACTION_PROTECTED_TAIL_TURNS,
  COMPACTION_SUMMARY_ALLOWANCE_TOKENS,
} from './constants'
import { runFoldOldestExchange } from './fold-exchange'

import type { SummaryEntry } from './summarize-messages'
import type { AgentState } from '../types/agent-definition'
import type { Logger, Message } from '../types/util-types'

export function runMinimalSurgery(params: {
  agentState: AgentState
  assistantToolBudget: number
  cacheExpiryMs: number
  contextTokenCount: number
  currentMessages: Message[]
  forceCompact: boolean
  foldOldestExchange: boolean
  instructionsPromptMessage: Message | null
  isMidTurnPrune: boolean
  keepRecentTokens: number
  latestLiveUserPromptMessage: Message | null
  logger: Logger
  maxContextLength: number
  previousSummaryContent: string
  previousSummaryEntries: SummaryEntry[]
  userBudget: number
}): { currentMessages: Message[]; earlyReturn: boolean } {
  const {
    agentState,
    assistantToolBudget,
    cacheExpiryMs,
    contextTokenCount,
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
  } = params

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
      totalTokens: Math.max(totalEstimate, contextTokenCount),
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
        cacheExpiryMs,
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
      if (recounted <= maxContextLength) {
        return { currentMessages: surgeryMessages, earlyReturn: true }
      }
    }
  }
  return { currentMessages: surgeryMessages, earlyReturn: false }
}

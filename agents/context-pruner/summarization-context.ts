// FID-2026-0819-005 Loop 141: summarization-parameter preparation, extracted
// from main.ts (budgets, digest caps, previous-summary extraction, and
// mid-turn detection — pure, no yields). Registered in handle-steps.ts
// embeddedHelpers so the serialized generator scope resolves it.

import {
  ASSISTANT_TOOL_BUDGET,
  FIXED_TAIL_BUDGET_TOKENS,
  USER_BUDGET,
} from './constants'
import { asNumber, asObject, asStringArray } from './helpers'
import {
  extractSummaryContent,
  isConversationSummary,
  parseSummaryIntoEntries,
  shouldExcludeMessage,
} from './summary-parsing'

import type { AgentState } from '../types/agent-definition'
import type { JSONValue, Message } from '../types/util-types'

/**
 * FID-2026-1006-003 WP2: the cumulative file ledger the runtime step boundary
 * folds across compactions (plain data — this module is serialized).
 */
export type LedgerFiles = {
  readFiles: string[]
  modifiedFiles: string[]
  createdFiles: string[]
}

export type SummarizationContext = {
  assistantToolBudget: number
  userBudget: number
  keepRecentTokens: number
  /**
   * FID-2026-1006-003 WP1: first index of the window the runtime planned to
   * summarize (its previous kept boundary). Content before it is already in
   * the carried summary, so it is never summarized a second time.
   */
  cutWindowStart: number
  /** FID-2026-1006-003 WP2: file ops from windows that aged out of a summary. */
  fileLedger: LedgerFiles | null
  digestCaps: { headChars?: number; tailChars?: number } | undefined
  previousSummaryContent: string
  previousSummaryEntries: ReturnType<typeof parseSummaryIntoEntries>
  latestLiveUserPromptIndex: number
  latestLiveUserPromptMessage: Message | null
  isMidTurnPrune: boolean
}

export function buildSummarizationContext(params: {
  currentMessages: Message[]
  params: Record<string, JSONValue>
  agentState?: AgentState
}): SummarizationContext {
  const { currentMessages, params: spawnParams } = params

  // === SUMMARIZATION STRATEGY ===
  // 1. Summarize ALL messages (apply transformations: truncation, tool summaries, etc.)
  // 2. Walk backwards through summarized parts to apply token budgets
  // 3. Older summarized parts beyond the budgets are dropped

  const assistantToolBudget: number =
    asNumber(spawnParams.assistantToolBudget) ?? ASSISTANT_TOOL_BUDGET
  const userBudget: number = asNumber(spawnParams.userBudget) ?? USER_BUDGET
  // P2a: fixed verbatim recent-tail token budget (DeepSeek 16 384 default).
  const keepRecentTokens: number =
    asNumber(spawnParams.keepRecentTokens) ?? FIXED_TAIL_BUDGET_TOKENS
  // FID-2026-0824-024 post-closure amendment: operator-configured digest
  // caps injected via spawn params override the baked defaults. Forwarded to
  // the full-sweep summarizer; the fold path keeps baked defaults.
  const digestHeadCharsParam =
    asNumber(spawnParams.digestHeadChars) ?? undefined
  const digestTailCharsParam =
    asNumber(spawnParams.digestTailChars) ?? undefined
  // FID-2026-1006-003 WP1/WP2: the compaction inputs the runtime computed at
  // its step boundary, read defensively as DATA. The plan's window opens at
  // the previous kept boundary; the ledger carries the file ops of windows
  // that have aged out of any single summary.
  const cutPlan = asObject(spawnParams.cutPlan ?? null)
  const segments = cutPlan?.segments
  const firstSegment = Array.isArray(segments)
    ? asObject(segments[0] ?? null)
    : undefined
  const cutWindowStart = Math.max(0, asNumber(firstSegment?.start ?? null) ?? 0)
  const ledgerRaw = asObject(spawnParams.fileLedger ?? null)
  const fileLedger: LedgerFiles | null = ledgerRaw
    ? {
        readFiles: asStringArray(ledgerRaw.readFiles ?? null) ?? [],
        modifiedFiles: asStringArray(ledgerRaw.modifiedFiles ?? null) ?? [],
        createdFiles: asStringArray(ledgerRaw.createdFiles ?? null) ?? [],
      }
    : null
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

  return {
    assistantToolBudget,
    userBudget,
    keepRecentTokens,
    cutWindowStart,
    fileLedger,
    digestCaps,
    previousSummaryContent,
    previousSummaryEntries,
    latestLiveUserPromptIndex,
    latestLiveUserPromptMessage,
    isMidTurnPrune,
  }
}

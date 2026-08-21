import { applyBudgets } from './apply-budgets'
import { SUMMARY_DISCLAIMER, SUMMARY_HEADER } from './constants'
import { getTextContent } from './helpers'
import {
  buildPreservedState,
  extractPreservedState,
  mergePreservedState,
  serializePreservedState,
} from './preserved-state'
import {
  buildStructuredSummary,
  findFirstUserTurnText,
} from './structured-summary'
import { summarizeMessages } from './summarize-messages'
import { isConversationSummary, shouldExcludeMessage } from './summary-parsing'
import {
  buildFoldTelemetryBase,
  logFoldCompleted,
  logFoldNoop,
} from './telemetry'

import type { SummaryEntry } from './summarize-messages'
import type { AgentState, ToolCall } from '../types/agent-definition'
import type {
  FilePart,
  ImagePart,
  Logger,
  Message,
  TextPart,
  UserMessage,
} from '../types/util-types'

type FoldExchangeContext = {
  agentState: AgentState
  assistantToolBudget: number
  cacheExpiryMs: number
  currentMessages: Message[]
  forceCompact: boolean
  instructionsPromptMessage: Message | null
  isMidTurnPrune: boolean
  keepRecentTokens: number
  latestLiveUserPromptMessage: Message | null
  logger: Logger
  maxContextLength: number
  previousSummaryContent: string
  previousSummaryEntries: SummaryEntry[]
  userBudget: number
}

export function runFoldOldestExchange({
  agentState,
  assistantToolBudget,
  cacheExpiryMs,
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
}: FoldExchangeContext): ToolCall<'set_messages'> {
  let lastSummaryIndex = -1
  for (let i = currentMessages.length - 1; i >= 0; i--) {
    if (isConversationSummary(currentMessages[i])) {
      lastSummaryIndex = i
      break
    }
  }

  let exchangeStart = -1
  for (let i = lastSummaryIndex + 1; i < currentMessages.length; i++) {
    const m = currentMessages[i]
    if (shouldExcludeMessage(m)) continue
    if (m.role === 'user') {
      exchangeStart = i
      break
    }
  }

  const nothingToFold =
    exchangeStart === -1 || exchangeStart >= currentMessages.length - 1
  const nowFold = Date.now()
  const foldTelemetryBase = buildFoldTelemetryBase({
    agentState,
    maxContextLength,
    cacheExpiryMs,
    previousSummaryEntryCount: previousSummaryEntries.length,
    userBudget,
    assistantToolBudget,
    keepRecentTokens,
    forceCompact,
    isMidTurnPrune,
    liveUserPromptFound: latestLiveUserPromptMessage !== null,
  })

  if (nothingToFold) {
    logFoldNoop(logger, foldTelemetryBase, currentMessages.length)
    return {
      toolName: 'set_messages',
      input: { messages: currentMessages },
      includeToolCall: false,
    }
  }

  let exchangeEnd = currentMessages.length
  for (let i = exchangeStart + 1; i < currentMessages.length; i++) {
    if (currentMessages[i].role === 'user') {
      exchangeEnd = i
      break
    }
  }

  const exchangeMessages = currentMessages.slice(exchangeStart, exchangeEnd)
  const remainingMessages = currentMessages.slice(exchangeEnd)
  const { entries: foldEntries } = summarizeMessages(exchangeMessages, null)
  let foldEntriesAll = foldEntries
  if (
    isMidTurnPrune &&
    latestLiveUserPromptMessage &&
    !exchangeMessages.includes(latestLiveUserPromptMessage)
  ) {
    const liveEntry = summarizeMessages(
      [latestLiveUserPromptMessage],
      latestLiveUserPromptMessage,
    ).entries
    foldEntriesAll = [...foldEntries, ...liveEntry]
  }
  const allFoldEntries: SummaryEntry[] = [
    ...previousSummaryEntries,
    ...foldEntriesAll,
  ]
  const foldBudgetResult = applyBudgets(
    allFoldEntries,
    assistantToolBudget,
    userBudget,
    keepRecentTokens,
  )

  const foldPreservedState = buildPreservedState(currentMessages)
  const foldPreviousPreservedState = extractPreservedState(
    previousSummaryContent,
  )
  const foldMergedPreservedState = mergePreservedState(
    foldPreviousPreservedState,
    foldPreservedState,
  )
  const foldPreservedStateJson = serializePreservedState(
    foldMergedPreservedState,
  )
  const foldFirstUserTurnPinned =
    findFirstUserTurnText(currentMessages) !== null
  const foldStructuredBlock = buildStructuredSummary({
    messages: currentMessages,
    goalText: latestLiveUserPromptMessage
      ? getTextContent(latestLiveUserPromptMessage).trim()
      : null,
    preservedState: foldMergedPreservedState,
  })
  const foldStructuredSummaryText = `${foldStructuredBlock}\n\n---\n\n${foldBudgetResult.summaryText}`
  const foldTaggedSummaryText = `<compaction-summary>\n${foldStructuredSummaryText}\n</compaction-summary>`

  const foldTextPart: TextPart = {
    type: 'text',
    text: `<conversation_summary>\n${SUMMARY_HEADER}\n\n<historical_memory>\n${foldTaggedSummaryText}\n</historical_memory>\n</conversation_summary>\n\n${SUMMARY_DISCLAIMER}`,
  }

  const foldImageParts: Array<ImagePart | FilePart> = []
  for (let i = remainingMessages.length - 1; i >= 0; i--) {
    const msg = remainingMessages[i]
    if (msg.role === 'user' && Array.isArray(msg.content)) {
      const imageParts = msg.content.filter(
        (part): part is ImagePart | FilePart =>
          part.type === 'image' || part.type === 'file',
      )
      if (imageParts.length > 0) {
        foldImageParts.push(...imageParts)
        break
      }
    }
  }
  const foldSummaryMessage: UserMessage = {
    role: 'user',
    content: [foldTextPart, ...foldImageParts],
    sentAt: nowFold,
  }

  const foldFinalMessages: Message[] = [foldSummaryMessage]
  if (instructionsPromptMessage) {
    foldFinalMessages.push({
      ...instructionsPromptMessage,
      sentAt: nowFold,
    })
  }
  for (const message of remainingMessages) {
    if (shouldExcludeMessage(message)) continue
    if (isConversationSummary(message)) continue
    if (message === latestLiveUserPromptMessage) continue
    foldFinalMessages.push(message)
  }
  if (isMidTurnPrune) {
    foldFinalMessages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Continue the existing assistant turn from the historical memory above. The original user request and completed assistant/tool work are recorded there. Do not restart completed work; resume with the next necessary real tool call or final response.',
        },
      ],
      sentAt: nowFold,
    })
  } else if (latestLiveUserPromptMessage) {
    foldFinalMessages.push({
      ...latestLiveUserPromptMessage,
      sentAt: nowFold,
    })
  }

  logFoldCompleted(logger, foldTelemetryBase, {
    foldedExchangeMessageCount: exchangeMessages.length,
    remainingMessageCount: remainingMessages.length,
    firstUserTurnPinned: foldFirstUserTurnPinned,
    structuredBlockChars: foldStructuredBlock.length,
    preservedStateJsonChars: foldPreservedStateJson.length,
    newestEntryForced: foldBudgetResult.newestEntryForced,
    taggedSummaryText: foldTaggedSummaryText,
  })

  return {
    toolName: 'set_messages',
    input: { messages: foldFinalMessages },
    includeToolCall: false,
  }
}

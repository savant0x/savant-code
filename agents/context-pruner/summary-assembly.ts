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

import type { SummaryEntry } from './summarize-messages'
import type {
  FilePart,
  ImagePart,
  Message,
  TextPart,
  UserMessage,
} from '../types/util-types'

type SummaryAssemblyContext = {
  assistantToolBudget: number
  currentMessages: Message[]
  instructionsPromptMessage: Message | null
  isMidTurnPrune: boolean
  keepRecentTokens: number
  latestLiveUserPromptIndex: number
  latestLiveUserPromptMessage: Message | null
  previousSummaryContent: string
  previousSummaryEntries: SummaryEntry[]
  userBudget: number
}

export type SummaryAssemblyResult = {
  allEntries: SummaryEntry[]
  firstUserTurnPinned: boolean
  finalMessages: Message[]
  includedEntries: SummaryEntry[]
  liveUserPromptEntry: SummaryEntry | undefined
  newestEntryForced: boolean
  preservedStateJson: string
  structuredBlock: string
  structuredSummaryText: string
  taggedSummaryText: string
}

export function buildFullSummary({
  assistantToolBudget,
  currentMessages,
  instructionsPromptMessage,
  isMidTurnPrune,
  keepRecentTokens,
  latestLiveUserPromptIndex,
  latestLiveUserPromptMessage,
  previousSummaryContent,
  previousSummaryEntries,
  userBudget,
}: SummaryAssemblyContext): SummaryAssemblyResult {
  const messagesToSummarize = currentMessages
    .filter(
      (_message, index) =>
        isMidTurnPrune || index !== latestLiveUserPromptIndex,
    )
    .filter(
      (message) =>
        !shouldExcludeMessage(message) && !isConversationSummary(message),
    )

  let lastUserImageParts: Array<ImagePart | FilePart> = []
  for (let i = messagesToSummarize.length - 1; i >= 0; i--) {
    const msg = messagesToSummarize[i]
    if (msg.role === 'user' && Array.isArray(msg.content)) {
      const imageParts = msg.content.filter(
        (part): part is ImagePart | FilePart =>
          part.type === 'image' || part.type === 'file',
      )
      if (imageParts.length > 0) {
        lastUserImageParts = imageParts
        break
      }
    }
  }

  const { entries: summarizedEntries, liveUserPromptEntry } = summarizeMessages(
    messagesToSummarize,
    latestLiveUserPromptMessage,
  )
  const allEntries: SummaryEntry[] = [
    ...previousSummaryEntries,
    ...summarizedEntries,
  ]
  const { includedEntries, newestEntryForced, summaryText } = applyBudgets(
    allEntries,
    assistantToolBudget,
    userBudget,
    keepRecentTokens,
  )

  const preservedState = buildPreservedState(currentMessages)
  const previousPreservedState = extractPreservedState(previousSummaryContent)
  const mergedPreservedState = mergePreservedState(
    previousPreservedState,
    preservedState,
  )
  const preservedStateJson = serializePreservedState(mergedPreservedState)
  const firstUserTurnPinned = findFirstUserTurnText(currentMessages) !== null
  const structuredBlock = buildStructuredSummary({
    messages: currentMessages,
    goalText: latestLiveUserPromptMessage
      ? getTextContent(latestLiveUserPromptMessage).trim()
      : null,
    preservedState: mergedPreservedState,
  })
  const structuredSummaryText = `${structuredBlock}\n\n---\n\n${summaryText}`
  const taggedSummaryText = `<compaction-summary>\n${structuredSummaryText}\n</compaction-summary>`

  const now = Date.now()
  const textPart: TextPart = {
    type: 'text',
    text: `<conversation_summary>
${SUMMARY_HEADER}

<historical_memory>
${taggedSummaryText}
</historical_memory>
</conversation_summary>

${SUMMARY_DISCLAIMER}`,
  }
  const summaryContentParts: (TextPart | ImagePart | FilePart)[] = [textPart]
  for (const part of lastUserImageParts) {
    summaryContentParts.push(part)
  }
  const summarizedMessage: UserMessage = {
    role: 'user',
    content: summaryContentParts,
    sentAt: now,
  }

  const continuationMessage: UserMessage = {
    role: 'user',
    content: [
      {
        type: 'text',
        text: 'Continue the existing assistant turn from the historical memory above. The original user request and completed assistant/tool work are recorded there. Do not restart completed work; resume with the next necessary real tool call or final response.',
      },
    ],
    sentAt: now,
  }

  const finalMessages: Message[] = [summarizedMessage]
  if (instructionsPromptMessage) {
    finalMessages.push({ ...instructionsPromptMessage, sentAt: now })
  }
  if (isMidTurnPrune) {
    finalMessages.push(continuationMessage)
  } else if (latestLiveUserPromptMessage) {
    finalMessages.push({ ...latestLiveUserPromptMessage, sentAt: now })
  }

  return {
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
  }
}

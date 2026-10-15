import { CompactionMessage_ } from './phases'

import type { ReactiveCompactResult } from './state'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

/**
 * Layer 4 pass: reactive compact — emergency truncation on prompt-too-long
 * error.
 *
 * Preserves: first message (system/instructions), last 20% of messages
 * (minimum 2), any messages with images (multimodal context), and any
 * compaction-summary / preserved-state messages (FID-2026-0806-003 Phase 1
 * P1b — the structured state must survive emergency truncation, not just
 * the pruner path). Retries API call once after truncation.
 */
export function runReactiveCompact(params: {
  messages: Message[]
  logger: Logger
}): ReactiveCompactResult {
  const { messages, logger } = params
  if (messages.length <= 2) {
    return {
      truncated: false,
      messages,
      tokensSaved: 0,
      messagesRemoved: 0,
    }
  }

  // Preserve first message
  const firstMessage = messages[0]

  // Preserve last 20% (minimum 2)
  const keepFromEnd = Math.max(2, Math.floor(messages.length * 0.2))
  const lastMessages = messages.slice(-keepFromEnd)

  // FID-2026-0815-006 (F-06): single forward walk builds the preserved-index
  // set and the ordered image / preserved-state / critical lists, replacing
  // the previous three `filter` passes plus the repeated `indexOf` scans.
  const imageMessages: Message[] = []
  const preservedStateMessages: Message[] = []
  const criticalMessages: Message[] = []
  const preservedIndices = new Set<number>([0]) // first message
  const lastStartIndex = messages.length - keepFromEnd
  for (let i = 0; i < messages.length; i++) {
    if (i >= lastStartIndex) {
      preservedIndices.add(i)
    }
    const msg = messages[i]
    const content = msg.content
    // Preserve messages with images (multimodal). 'image_url' was a
    // loose-shape legacy check from the pre-Message CompactionMessage type.
    const hasImage =
      typeof content !== 'string' &&
      Array.isArray(content) &&
      content.some((part) => part.type === 'image')
    if (hasImage) {
      imageMessages.push(msg)
      preservedIndices.add(i)
    }
    // P1b (FID-2026-0806-003): preserve compaction-summary / preserved-state
    // messages (at most one <conversation_summary> at any time).
    if (CompactionMessage_.hasPreservedState(msg)) {
      preservedStateMessages.push(msg)
      preservedIndices.add(i)
    }
    // FID-2026-0806-005 Layer 3: preserve protocol-refresh messages.
    if (CompactionMessage_.hasCriticalContext(msg)) {
      criticalMessages.push(msg)
      preservedIndices.add(i)
    }
  }

  // Middle-preserved messages (images / preserved-state / critical-context)
  // not already covered by the first-message or last-20% slots, deduplicated
  // and in original order. Set membership makes the dedupe and the last-20%
  // exclusion O(1) per element.
  const lastMessagesSet = new Set<Message>(lastMessages)
  const seen = new Set<Message>()
  const reAddedPreserved: Message[] = []
  for (const msg of [
    ...imageMessages,
    ...preservedStateMessages,
    ...criticalMessages,
  ]) {
    if (seen.has(msg) || msg === firstMessage || lastMessagesSet.has(msg)) {
      continue
    }
    seen.add(msg)
    reAddedPreserved.push(msg)
  }

  const truncated = [
    firstMessage,
    ...messages
      .filter((_, idx) => !preservedIndices.has(idx) && idx !== 0)
      .slice(0, Math.floor(messages.length * 0.1)), // Keep 10% of middle for context
    ...reAddedPreserved,
    ...lastMessages,
  ]

  // Rough token estimate
  const tokensSaved = (messages.length - truncated.length) * 500

  logger.warn(
    {
      originalCount: messages.length,
      truncatedCount: truncated.length,
      tokensSaved,
    },
    'Reactive compact: emergency truncation applied',
  )

  return {
    truncated: true,
    messages: truncated,
    tokensSaved,
    messagesRemoved: messages.length - truncated.length,
  }
}

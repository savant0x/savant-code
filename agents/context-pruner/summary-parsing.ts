/**
 * Pure summary-parsing helpers extracted from `main.ts` (FID-2026-0809-015
 * Batch A). These functions are embedded into the serialized handleSteps
 * scope via `.toString()` in handle-steps.ts — they must reference only
 * literals, params, locals, and baked constants / embedded helpers
 * (FID-2026-0802-005 L5). No module-level mutable state, no closures.
 */
import { SUMMARY_HEADER } from './constants'
import { getTextContent } from './helpers'

import type { Message } from '../types/util-types'

export function shouldExcludeMessage(message: Message): boolean {
  if (message.tags?.includes('INSTRUCTIONS_PROMPT')) return true
  if (message.tags?.includes('STEP_PROMPT')) return true
  if (message.tags?.includes('SUBAGENT_SPAWN')) return true
  // FID-2026-0806-002 Phase 3c: harness-injected knowledge-graph evidence is
  // operational metadata, not user-authored dialogue — excluded from the
  // summary exactly like the other system-tagged operational messages.
  if (message.tags?.includes('GRAPH_EVIDENCE')) return true
  // FID-2026-0916-006 MQ2 (operator ruling): the ECHO protocol refresh is
  // re-injected on its own cadence — it never needs summary space, and
  // transcribing it made the refresh dump the artifact's "standing facts".
  if (message.tags?.includes('ECHO_REFRESH')) return true
  return false
}

export function isConversationSummary(message: Message): boolean {
  if (message.role !== 'user') return false
  return getTextContent(message).includes('<conversation_summary>')
}

export function extractSummaryContent(message: Message): string {
  const text = getTextContent(message)
  const match = text.match(
    /<conversation_summary>([\s\S]*?)<\/conversation_summary>/,
  )
  if (!match) return ''
  let content = match[1].trim()
  if (content.startsWith(SUMMARY_HEADER)) {
    content = content.slice(SUMMARY_HEADER.length).trim()
  }
  const memoryMatch = content.match(
    /<historical_memory>([\s\S]*?)<\/historical_memory>/,
  )
  if (memoryMatch) {
    content = memoryMatch[1].trim()
  }
  // P2d: strip the <compaction-summary> wrapper emitted on the previous
  // round so the downstream parsers (parseSummaryIntoEntries /
  // extractPreservedState) see the same clean role-tagged text they saw
  // before the tags existed.
  content = content.replace(
    /<compaction-summary>[\s\S]*?<\/compaction-summary>/,
    (inner) =>
      inner.slice(
        '<compaction-summary>'.length,
        -'</compaction-summary>'.length,
      ),
  )
  return content.trim()
}

/**
 * Parses a previous summary text blob into role-tagged entries.
 * Splits on the --- separator and determines each chunk's role
 * based on its prefix marker.
 */
export function parseSummaryIntoEntries(
  summaryText: string,
): Array<{ role: 'user' | 'assistant_tool'; parts: string[] }> {
  if (!summaryText.trim()) return []

  const separator = '\n\n---\n\n'
  const chunks = summaryText.split(separator).filter((c) => c.trim())

  return chunks.map((chunk) => {
    const trimmed = chunk.trim()
    const isUser =
      trimmed.startsWith('[USER]') ||
      trimmed.startsWith('User request') ||
      trimmed.startsWith('User message') ||
      trimmed.startsWith('Current unresolved user request') ||
      // P2d: a prior <structured_state> block carries user intent verbatim
      // (Standing facts + pinned first user turn). Classify it as a user
      // entry so it rides the user budget on re-distill instead of being
      // evicted by the assistant/tool budget — the P1c guarantee survives
      // across repeated compactions.
      trimmed.startsWith('<structured_state>') ||
      trimmed.includes('## Standing facts & constraints')
    return {
      role: isUser ? ('user' as const) : ('assistant_tool' as const),
      parts: [trimmed],
    }
  })
}

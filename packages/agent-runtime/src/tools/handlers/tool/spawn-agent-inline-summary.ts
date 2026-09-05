/** FID-2026-0824-023 stream-routing: bounded capture of the pruner's streamed summary text. */
export const PRUNER_SUMMARY_BUFFER_CHARS = 8_000
// FID-2026-0824-023 V2 completion: persist half the buffer so the
// CompactionSignal expander can reveal a genuinely full summary excerpt.
export const PRUNER_SUMMARY_EXCERPT_CHARS = 4_000

const CONVERSATION_SUMMARY_OPEN = '<conversation_summary>'
const CONVERSATION_SUMMARY_CLOSE = '</conversation_summary>'
const HISTORICAL_MEMORY_OPEN = '<historical_memory>'
const HISTORICAL_MEMORY_CLOSE = '</historical_memory>'
const COMPACTION_SUMMARY_OPEN = '<compaction-summary>'
const COMPACTION_SUMMARY_CLOSE = '</compaction-summary>'
const STRUCTURED_STATE_OPEN = '<structured_state>'
const STRUCTURED_STATE_CLOSE = '</structured_state>'

/**
 * Extract the pruner's summary text from the compacted history's memory
 * message. The context-pruner writes the summary into
 * `<conversation_summary>` → `<historical_memory>` → `<compaction-summary>`
 * as `finalMessages[0]` (summary-assembly.ts) — the same single source of
 * truth the pruner itself parses via extractSummaryContent. Mirrors that
 * tag-walking order so the transcript block surfaces the EXACT text the
 * pruner embedded (FID-2026-0828-001, Law 13). Falls back to '' when no
 * summary message is present or the compaction-summary wrapper is absent.
 *
 * This is the production source of truth for a PROGRAMMATIC context-pruner
 * (handleSteps generator): it never streams text through onResponseChunk,
 * so the FID-2026-0824-023 streamed-text buffer stays empty and the summary
 * must be recovered from the history it emitted.
 */
export function extractPrunerSummaryFromHistory(
  messageHistory: readonly unknown[],
): string {
  for (const raw of messageHistory) {
    if (raw === null || typeof raw !== 'object') continue
    const message = raw as {
      role?: unknown
      content?: unknown
    }
    if (message.role !== 'user') continue
    let text = ''
    const content = message.content
    if (typeof content === 'string') {
      text = content
    } else if (Array.isArray(content)) {
      for (const part of content) {
        if (
          part !== null &&
          typeof part === 'object' &&
          (part as { type?: unknown }).type === 'text' &&
          typeof (part as { text?: unknown }).text === 'string'
        ) {
          text += (part as { text?: string }).text
        }
      }
    }
    const convMatch = text.match(
      new RegExp(
        `${CONVERSATION_SUMMARY_OPEN}([\\s\\S]*?)${CONVERSATION_SUMMARY_CLOSE}`,
      ),
    )
    if (!convMatch) continue
    const memoryMatch = convMatch[1].match(
      new RegExp(
        `${HISTORICAL_MEMORY_OPEN}([\\s\\S]*?)${HISTORICAL_MEMORY_CLOSE}`,
      ),
    )
    const memoryContent = memoryMatch ? memoryMatch[1] : convMatch[1]
    const summaryMatch = memoryContent.match(
      new RegExp(
        `${COMPACTION_SUMMARY_OPEN}([\\s\\S]*?)${COMPACTION_SUMMARY_CLOSE}`,
      ),
    )
    if (summaryMatch) {
      // The pruner's structured block is framed in XML wire tags intended for
      // the MODEL's history (<structured_state>…</structured_state>). For a
      // user-facing transcript block they are formatting noise, so unwrap them
      // the same way the pruner's own extractSummaryContent unwraps its wire
      // tags — the interior (headings, bullets, preserved state) is the real
      // readable summary. stripStructuredStateWrappers keeps everything else,
      // including the '---' assigned-user/assistant budget section that follows.
      return stripStructuredStateWrappers(summaryMatch[1]).trim()
    }
  }
  return ''
}

/**
 * Remove the <structured_state> and </structured_state> framing tags, keeping
 * the interior (and any surrounding separator + budgeted-entries text) intact.
 * Tag order is deterministic (structured-summary.ts buildPreservedStateSection
 * closes the block last), so a targeted strip is safe and never deletes the
 * readable content between the tags.
 */
export function stripStructuredStateWrappers(text: string): string {
  return text.replace(
    new RegExp(`${STRUCTURED_STATE_OPEN}[\\s\\S]*?${STRUCTURED_STATE_CLOSE}`),
    (match) =>
      match.slice(STRUCTURED_STATE_OPEN.length, -STRUCTURED_STATE_CLOSE.length),
  )
}

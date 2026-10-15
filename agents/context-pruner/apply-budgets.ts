/**
 * Phase 2 + 3 of the context-pruner: walk backwards through all entries
 * applying independent role budgets, force-keep the newest entry, then build
 * the final summary text (extracted verbatim from the original in-body
 * implementation). Embedded via .toString() at factory time.
 */
import { CHARS_PER_TOKEN, FIXED_TAIL_BUDGET_TOKENS } from './constants'

import type { SummaryEntry } from './summarize-messages'

export function applyBudgets(
  allEntries: SummaryEntry[],
  assistantToolBudget: number,
  userBudget: number,
  /** P2a fixed verbatim recent-tail token budget (DeepSeek pattern). */
  keepRecentTokens: number = FIXED_TAIL_BUDGET_TOKENS,
): {
  includedEntries: SummaryEntry[]
  newestEntryForced: boolean
  summaryText: string
} {
  // Phase 2 (P2a): reserve the fixed verbatim tail FIRST. The newest entries
  // totaling <= keepRecentTokens are force-kept regardless of role budgets — a
  // fixed absolute budget (default 16 384) so re-compaction loops can't form.
  const tailCovered = new Set<SummaryEntry>()
  let tailTokens = 0
  if (keepRecentTokens > 0) {
    for (let i = allEntries.length - 1; i >= 0; i--) {
      const entry = allEntries[i]
      const entryTokens = Math.ceil(
        entry.parts.join('\n\n---\n\n').length / CHARS_PER_TOKEN,
      )
      if (tailTokens + entryTokens > keepRecentTokens) continue
      tailCovered.add(entry)
      tailTokens += entryTokens
    }
  }

  // Phase 2: Walk backwards through the NON-tail entries applying independent
  // role budgets. Exhausting one role's budget must not evict entries from the
  // other role: user prompts are protected by the user budget independently of
  // how much assistant/tool history the conversation accumulated, and vice
  // versa. Tail entries are skipped here — they are force-included below.
  let assistantToolTokens = 0
  let userTokens = 0
  let assistantToolBudgetExhausted = false
  let userBudgetExhausted = false
  const includedEntries: SummaryEntry[] = []

  for (let i = allEntries.length - 1; i >= 0; i--) {
    const entry = allEntries[i]
    if (tailCovered.has(entry)) continue
    const entryText = entry.parts.join('\n\n---\n\n')
    const entryTokens = Math.ceil(entryText.length / CHARS_PER_TOKEN)

    if (entry.role === 'user') {
      if (userBudgetExhausted) continue
      if (userTokens + entryTokens > userBudget) {
        userBudgetExhausted = true
        continue
      }
      userTokens += entryTokens
    } else {
      if (assistantToolBudgetExhausted) continue
      if (assistantToolTokens + entryTokens > assistantToolBudget) {
        assistantToolBudgetExhausted = true
        continue
      }
      assistantToolTokens += entryTokens
    }

    includedEntries.push(entry)
  }

  // Force-include the reserved tail (newest-first, reverse-chronological).
  for (let i = allEntries.length - 1; i >= 0; i--) {
    const entry = allEntries[i]
    if (tailCovered.has(entry) && !includedEntries.includes(entry)) {
      includedEntries.push(entry)
    }
  }

  // Preserve the pre-existing guarantee that the newest entry always
  // survives, even when it alone exceeds its role's budget. With independent
  // role selection, entries from the other role may still fit, so the old
  // "summary is empty" fallback is no longer sufficient.
  const newestEntry = allEntries[allEntries.length - 1]
  let newestEntryForced = false
  if (newestEntry && !includedEntries.includes(newestEntry)) {
    // includedEntries is reverse-chronological until Phase 3.
    includedEntries.unshift(newestEntry)
    newestEntryForced = true
  }

  // Phase 3: Build final summary from included entries
  const summaryParts: string[] = []

  for (let i = includedEntries.length - 1; i >= 0; i--) {
    summaryParts.push(...includedEntries[i].parts)
  }

  const summaryText = summaryParts.join('\n\n---\n\n')
  return { includedEntries, newestEntryForced, summaryText }
}

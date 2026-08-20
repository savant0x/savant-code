/**
 * Tests for the context-pruner applyBudgets function (Phase 2+3).
 * Verifies tail budget reservation, independent role budgets, newest-entry
 * force-keep, and summary text assembly.
 */
import { describe, expect, it } from 'bun:test'

import { applyBudgets } from '../apply-budgets'

import type { SummaryEntry } from '../summarize-messages'

function entry(role: 'user' | 'assistant_tool', text: string): SummaryEntry {
  return { role, parts: [text] }
}

describe('applyBudgets', () => {
  it('includes all entries when within budget', () => {
    const entries = [
      entry('user', 'short question'),
      entry('assistant_tool', 'short answer'),
    ]
    const result = applyBudgets(entries, 20_000, 50_000, 16_384)
    expect(result.includedEntries).toHaveLength(2)
    expect(result.summaryText).toContain('short question')
    expect(result.summaryText).toContain('short answer')
  })

  it('force-keeps the newest entry even when it exceeds role budget', () => {
    const huge = 'x'.repeat(30_000)
    const entries = [entry('user', 'first'), entry('assistant_tool', huge)]
    const result = applyBudgets(entries, 100, 100, 0)
    expect(result.newestEntryForced).toBe(true)
    expect(result.includedEntries).toContain(entries[1])
  })

  it('assembles summary text in chronological order', () => {
    const entries = [
      entry('user', 'turn one'),
      entry('assistant_tool', 'worked on it'),
      entry('user', 'turn two'),
    ]
    const result = applyBudgets(entries, 20_000, 50_000, 16_384)
    const oneIndex = result.summaryText.indexOf('turn one')
    const twoIndex = result.summaryText.indexOf('turn two')
    expect(oneIndex).toBeGreaterThanOrEqual(0)
    expect(twoIndex).toBeGreaterThan(oneIndex)
  })

  it('reserves the verbatim tail regardless of role budgets', () => {
    // With a keepRecentTokens budget, the newest entries are force-kept
    // even if their content is large.
    const recent = entry('assistant_tool', 'y'.repeat(5_000))
    const entries = [entry('user', 'old'), recent]
    const result = applyBudgets(entries, 10, 10, 16_384)
    expect(result.includedEntries).toContain(recent)
  })

  it('applies user and assistant/tool budgets independently', () => {
    // A large assistant history must not evict user entries, and vice versa.
    const userEntry = entry('user', 'a'.repeat(40_000))
    const toolEntry = entry('assistant_tool', 'b'.repeat(15_000))
    const entries = [userEntry, toolEntry]
    const result = applyBudgets(entries, 100, 50_000, 0)
    // user budget (50_000) accommodates the 40k user entry
    expect(result.includedEntries).toContain(userEntry)
  })

  it('returns empty summary when given no entries', () => {
    const result = applyBudgets([], 20_000, 50_000, 16_384)
    expect(result.includedEntries).toHaveLength(0)
    expect(result.summaryText).toBe('')
    expect(result.newestEntryForced).toBe(false)
  })

  it('separates parts with the --- delimiter', () => {
    const entries = [
      { role: 'user' as const, parts: ['part A', 'part B'] },
      { role: 'assistant_tool' as const, parts: ['part C'] },
    ]
    const result = applyBudgets(entries, 20_000, 50_000, 16_384)
    expect(result.summaryText).toContain('part A\n\n---\n\npart B')
    expect(result.summaryText).toContain('part C')
  })
})

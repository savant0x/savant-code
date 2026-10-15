import { describe, expect, test } from 'bun:test'

import { parseThinkingInput } from '../thinking-parse'

describe('parseThinkingInput (sequential-thinking parity)', () => {
  test('returns null for empty/missing thought', () => {
    expect(parseThinkingInput(null)).toBeNull()
    expect(parseThinkingInput('{}')).toBeNull()
    expect(parseThinkingInput('{"thought":""}')).toBeNull()
    expect(parseThinkingInput('not json')).toBeNull()
  })

  test('extracts a numbered thought label', () => {
    const payload = parseThinkingInput(
      JSON.stringify({
        thought: 'look for existing code',
        thoughtNumber: 2,
        totalThoughts: 5,
      }),
    )
    expect(payload?.label).toBe('💭 Thought 2/5')
    expect(payload?.markdown).toContain('look for existing code')
  })

  test('a revision is labeled as revising', () => {
    const payload = parseThinkingInput(
      JSON.stringify({
        thought: 'rethink',
        isRevision: true,
        revisesThought: 3,
        branchId: 'b1',
      }),
    )
    expect(payload?.label).toBe('↩️ Revising thought #3 · b1')
  })

  test('preview contains the label and first line', () => {
    const payload = parseThinkingInput(
      JSON.stringify({
        thought: 'first line\nsecond',
        thoughtNumber: 1,
        totalThoughts: 2,
      }),
    )
    expect(payload?.preview).toContain('💭 Thought 1/2')
    expect(payload?.preview).toContain('first line')
  })
})

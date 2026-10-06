import { describe, expect, test } from 'bun:test'

import {
  findCutPoint,
  findPreviousKeptBoundary,
  isIllegalCut,
  mergeSplitSummaries,
  segmentTurns,
} from '../context-compactor/cut-points'

import type { Message } from '@savant-code/common/types/messages/savant-code-message'

const user = (text: string, tags?: string[]): Message => ({
  role: 'user',
  content: [{ type: 'text', text }],
  ...(tags ? { tags } : {}),
})

const assistant = (text: string, tags?: string[]): Message => ({
  role: 'assistant',
  content: [{ type: 'text', text }],
  ...(tags ? { tags } : {}),
})

const call = (id: string, tags?: string[]): Message => ({
  role: 'assistant',
  content: [
    { type: 'tool-call', toolCallId: id, toolName: 'read_files', input: {} },
  ],
  ...(tags ? { tags } : {}),
})

const result = (id: string, tags?: string[]): Message => ({
  role: 'tool',
  toolCallId: id,
  toolName: 'read_files',
  content: [{ type: 'json', value: 'ok' }],
  ...(tags ? { tags } : {}),
})

/** Deterministic estimator: tagged messages cost 100, others 1. */
const estimate = (message: Message): number =>
  message.tags?.includes('big') ? 100 : 1

describe('cut-points: segmentTurns (FID-2026-1006-002 WP5)', () => {
  test('groups assistant/tool messages into the preceding user turn', () => {
    const messages = [
      user('one'),
      assistant('working'),
      result('c1'),
      user('two'),
      assistant('done'),
    ]
    expect(segmentTurns(messages)).toEqual([
      { start: 0, end: 3 },
      { start: 3, end: 5 },
    ])
  })

  test('leading assistant/tool messages form a synthetic first turn at 0', () => {
    const messages = [assistant('resume'), result('c0'), user('one')]
    expect(segmentTurns(messages)).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 3 },
    ])
  })
})

describe('cut-points: isIllegalCut — never cut at a tool result', () => {
  test('a boundary opening on a tool result is illegal; other boundaries are legal', () => {
    const messages = [user('one'), call('c1'), result('c1'), assistant('done')]
    expect(isIllegalCut(messages, 2)).toBe(true) // opens on the tool result
    expect(isIllegalCut(messages, 1)).toBe(false) // opens on the call
    expect(isIllegalCut(messages, 3)).toBe(false)
    expect(isIllegalCut(messages, 0)).toBe(false) // edges are not boundaries
    expect(isIllegalCut(messages, 4)).toBe(false)
  })
})

describe('cut-points: findCutPoint (FID-2026-1006-002 WP5)', () => {
  test('moves the cut back to the boundary turn start and keeps the turn live', () => {
    const messages = [
      user('one'),
      assistant('work'),
      user('two'),
      assistant('work'),
    ]
    const plan = findCutPoint({
      messages,
      preferredIndex: 3,
      budgetTokens: 50,
      estimateTokens: estimate,
    })
    expect(plan.cutIndex).toBe(2)
    expect(plan.adjusted).toBe(true)
    expect(plan.segments).toEqual([{ start: 0, end: 2 }])
    expect(plan.splitTurn).toBeUndefined()
    expect(isIllegalCut(messages, plan.cutIndex)).toBe(false)
  })

  test('no adjustment when the preferred index is already a turn start', () => {
    const messages = [user('one'), assistant('a'), user('two'), assistant('b')]
    const plan = findCutPoint({
      messages,
      preferredIndex: 2,
      budgetTokens: 50,
      estimateTokens: estimate,
    })
    expect(plan.cutIndex).toBe(2)
    expect(plan.adjusted).toBe(false)
    expect(plan.segments).toEqual([{ start: 0, end: 2 }])
  })

  test('never returns a boundary at a tool result, even mid-turn preferences', () => {
    const messages = [
      user('one'),
      assistant('a'),
      user('two'),
      call('c2'),
      result('c2'),
      user('three'),
    ]
    const plan = findCutPoint({
      messages,
      preferredIndex: 4, // points at the tool result
      budgetTokens: 50,
      estimateTokens: estimate,
    })
    expect(messages[plan.cutIndex].role).not.toBe('tool')
    expect(isIllegalCut(messages, plan.cutIndex)).toBe(false)
  })

  test('over-budget boundary turn splits into two segments that merge', () => {
    const messages = [
      user('one'),
      assistant('a'),
      user('two'),
      call('c2', ['big']),
      result('c2', ['big']),
      assistant('summary work', ['big']),
      user('three'),
      assistant('b'),
    ]
    const plan = findCutPoint({
      messages,
      preferredIndex: 3,
      budgetTokens: 50,
      estimateTokens: estimate,
    })
    // Turn {2,6} costs 301 > 50 and splits at 3 (the legal index nearest the
    // midpoint 4, which sits on the illegal tool result).
    expect(plan.splitTurn).toEqual({ start: 2, end: 6, splitAt: 3 })
    expect(plan.cutIndex).toBe(6)
    expect(plan.segments).toEqual([
      { start: 0, end: 3 },
      { start: 3, end: 6 },
    ])
    expect(isIllegalCut(messages, plan.splitTurn!.splitAt)).toBe(false)
    // The live region opens on the next turn, never on a tool result.
    expect(messages[plan.cutIndex].role).toBe('user')
  })

  test('same turn under budget stays live whole (no split)', () => {
    const messages = [
      user('one'),
      assistant('a'),
      user('two'),
      call('c2', ['big']),
      result('c2', ['big']),
      assistant('work', ['big']),
      user('three'),
      assistant('b'),
    ]
    const plan = findCutPoint({
      messages,
      preferredIndex: 3,
      budgetTokens: 500, // 301 <= 500 → no split
      estimateTokens: estimate,
    })
    expect(plan.splitTurn).toBeUndefined()
    expect(plan.cutIndex).toBe(2)
    expect(plan.segments).toEqual([{ start: 0, end: 2 }])
  })

  test('repeated compaction re-summarizes from the previous kept boundary', () => {
    const messages = [
      user('one'),
      assistant('a'),
      user('two'),
      assistant('b'),
      user('three'),
      assistant('c'),
    ]
    const plan = findCutPoint({
      messages,
      preferredIndex: 5,
      budgetTokens: 50,
      estimateTokens: estimate,
      windowStart: 3,
    })
    // Nothing before the previous kept boundary is re-summarized.
    expect(plan.segments[0].start).toBe(3)
    expect(plan.segments).toEqual([{ start: 3, end: 4 }])
    expect(plan.cutIndex).toBe(4)
  })

  test('windowStart at or beyond the array yields an empty plan', () => {
    const messages = [user('one'), assistant('a')]
    const plan = findCutPoint({
      messages,
      preferredIndex: 0,
      budgetTokens: 50,
      estimateTokens: estimate,
      windowStart: 5, // beyond the array — clamped to the array end
    })
    expect(plan.cutIndex).toBe(2)
    expect(plan.segments).toEqual([])
    expect(plan.cutIndex).toBeLessThanOrEqual(messages.length)
  })
})

describe('cut-points: findPreviousKeptBoundary', () => {
  test('returns one past the last compaction-summary message', () => {
    const summary = user(
      '<conversation_summary><historical_memory>...</historical_memory></conversation_summary>',
    )
    const messages = [user('old'), summary, user('new'), assistant('a')]
    expect(findPreviousKeptBoundary(messages)).toBe(2)
  })

  test('returns 0 when no prior compaction exists', () => {
    expect(findPreviousKeptBoundary([user('a'), assistant('b')])).toBe(0)
  })
})

describe('cut-points: mergeSplitSummaries', () => {
  test('joins two non-empty summaries with the structured-summary separator', () => {
    expect(mergeSplitSummaries('first half', 'second half')).toBe(
      'first half\n\n---\n\nsecond half',
    )
  })

  test('drops an empty half', () => {
    expect(mergeSplitSummaries('only half', '  ')).toBe('only half')
    expect(mergeSplitSummaries('', 'second')).toBe('second')
  })
})

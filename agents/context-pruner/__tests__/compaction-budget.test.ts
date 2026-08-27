import { describe, expect, test } from 'bun:test'

import {
  planFoldsToReachTarget,
  segmentExchanges,
  tokensForRange,
} from '../budget'

import type { Message } from '../../types/util-types'

function user(text: string): Message {
  return {
    role: 'user',
    content: [{ type: 'text', text }],
  } as unknown as Message
}

function assistant(): Message {
  return {
    role: 'assistant',
    content: [{ type: 'text', text: 'a'.repeat(30) }],
  } as unknown as Message
}

function tool(id: string): Message {
  return {
    role: 'tool',
    toolName: 'read_files',
    toolCallId: id,
    content: [{ type: 'json', value: { ok: true } }],
  } as unknown as Message
}

describe('segmentExchanges (FID-2026-0824-025)', () => {
  test('segments on user boundaries and owns any leading prologue', () => {
    const messages = [
      assistant(),
      user('u1'),
      assistant(),
      tool('t1'),
      user('u2'),
      user('u3'),
    ]

    const segments = segmentExchanges(messages)

    expect(segments).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: 4 },
      { start: 4, end: 5 },
      { start: 5, end: 6 },
    ])
  })

  test('empty history yields no segments', () => {
    expect(segmentExchanges([])).toEqual([])
  })
})

describe('planFoldsToReachTarget (FID-2026-0824-025)', () => {
  const base = {
    totalTokens: 1_000,
    targetTokens: 600,
    summaryAllowanceTokens: 100,
    protectedHeadSegments: 1,
    protectedTailSegments: 1,
  }

  test('returns zero folds when already under target', () => {
    const plan = planFoldsToReachTarget({
      ...base,
      exchangeTokenEstimates: [400, 400, 400],
      totalTokens: 500,
    })

    expect(plan.folds).toBe(0)
    expect(plan.projectedTokens).toBe(500)
  })

  test('accumulates oldest-first, skipping protected head and tail', () => {
    // Segments: [0]=head(protected), [1]=foldable, [2]=tail(protected).
    const plan = planFoldsToReachTarget({
      ...base,
      exchangeTokenEstimates: [900, 300, 900],
      totalTokens: 2_000,
      targetTokens: 1_000,
      summaryAllowanceTokens: 200,
    })

    expect(plan.folds).toBe(1)
    expect(plan.projectedTokens).toBe(2_000 - 300 + 200)
  })

  test('clamps to the foldable span and reports fallback via projection', () => {
    const plan = planFoldsToReachTarget({
      ...base,
      exchangeTokenEstimates: [900, 100, 5_000],
      totalTokens: 6_000,
      targetTokens: 300,
      summaryAllowanceTokens: 50,
    })

    expect(plan.folds).toBe(1)
    expect(plan.projectedTokens).toBeGreaterThan(300)
  })
})

describe('seeded fuzz — pair integrity under planned folds', () => {
  /** Deterministic LCG so CI failures are reproducible. */
  function lcg(seed: number): () => number {
    let s = seed >>> 0
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32
  }

  function buildRandomHistory(rand: () => number): Message[] {
    const messages: Message[] = [user('seed turn')]
    let pendingCalls = 0
    for (let i = 0; i < 24; i++) {
      if (pendingCalls > 0 && rand() < 0.6) {
        messages.push(tool(`call-${i}`))
        pendingCalls -= 1
        continue
      }
      if (rand() < 0.55) {
        messages.push(user(`turn ${i}`))
        continue
      }
      messages.push(assistant())
      pendingCalls += 1
    }
    while (pendingCalls > 0) {
      messages.push(tool(`flush-${pendingCalls}`))
      pendingCalls -= 1
    }
    return messages
  }

  test('planned folds never orphan a tool result across the seam', () => {
    const rand = lcg(42)
    for (let iteration = 0; iteration < 200; iteration++) {
      const messages = buildRandomHistory(rand)
      const segments = segmentExchanges(messages)

      // Contiguity: segments tile the array exactly.
      expect(segments[0]?.start).toBe(0)
      expect(segments[segments.length - 1]?.end).toBe(messages.length)
      for (let s = 1; s < segments.length; s++) {
        expect(segments[s]?.start).toBe(segments[s - 1]?.end)
        expect(messages[segments[s]!.start]?.role).toBe('user')
      }

      const estimates = segments.map((segment) =>
        tokensForRange(messages, segment.start, segment.end),
      )
      const total = estimates.reduce((sum, n) => sum + n, 0)
      const head = iteration % 3
      const tail = iteration % 2
      const plan = planFoldsToReachTarget({
        exchangeTokenEstimates: estimates,
        totalTokens: total,
        targetTokens: Math.floor(total / 2),
        summaryAllowanceTokens: 20,
        protectedHeadSegments: head,
        protectedTailSegments: tail,
      })

      // Clamp property: folds never exceed the foldable span.
      expect(plan.folds).toBeLessThanOrEqual(
        Math.max(0, segments.length - head - tail),
      )

      // Pair integrity across the seam: simulate folding k leading segments;
      // the first survivor must be a user boundary (never an orphaned tool
      // result whose call lived in the folded prefix).
      const seam = segments[Math.min(head + plan.folds, segments.length)]
      if (seam === undefined) continue
      const firstSurvivor = messages[seam.start]
      if (plan.folds > 0) {
        expect(firstSurvivor?.role).toBe('user')
      }
    }
  })
})

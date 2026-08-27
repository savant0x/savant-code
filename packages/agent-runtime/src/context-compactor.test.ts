/**
 * FID-2026-0806-003 Phase 1 (P1b / R4): emergency reactive compaction must
 * preserve compaction-summary and <structured_state> preserved-state
 * messages, not just the first message, last 20%, and images.
 * Phase 3 (P3b): anti-thrash scoring — compaction effectiveness is judged
 * against the REAL post-response token count, never the preflight estimate.
 */
import { describe, expect, test } from 'bun:test'

import { ContextCompactor } from './context-compactor'

import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

function userMsg(text: string): Message {
  return { role: 'user', content: [{ type: 'text', text }] }
}

function buildHistory(count: number, summaryIndex?: number): Message[] {
  const messages: Message[] = []
  messages.push(userMsg('system-style first message'))
  for (let i = 1; i < count; i++) {
    messages.push(userMsg(`turn ${i}`))
  }
  if (summaryIndex !== undefined && summaryIndex >= 0 && summaryIndex < count) {
    messages[summaryIndex] = userMsg(
      '<conversation_summary>\n<historical_memory>\n<structured_state>\n## Preserved state\n{"todos":[],"readFiles":["src/x.ts"],"modifiedFiles":[],"createdFiles":[],"skills":[],"fid":null}\n</structured_state>\n</historical_memory>\n</conversation_summary>',
    )
  }
  return messages
}

describe('ContextCompactor.reactiveCompact (P1b / R4)', () => {
  test('preserves a mid-history conversation_summary message', () => {
    const compactor = new ContextCompactor({ logger: noopLogger })
    const history = buildHistory(100, 30) // summary in the middle
    const result = compactor.reactiveCompact(history)

    expect(result.truncated).toBe(true)
    expect(result.messages.length).toBeLessThan(history.length)
    const preserved = result.messages.find((m) =>
      JSON.stringify(m.content).includes('<conversation_summary>'),
    )
    expect(preserved).toBeDefined()
  })

  test('preserves a standalone <structured_state> message', () => {
    const compactor = new ContextCompactor({ logger: noopLogger })
    const history = buildHistory(100)
    history[40] = userMsg(
      '<structured_state>\n## Preserved state\n{"todos":[],"readFiles":[],"modifiedFiles":[],"createdFiles":[],"skills":[],"fid":null}\n</structured_state>',
    )
    const result = compactor.reactiveCompact(history)

    expect(result.truncated).toBe(true)
    const preserved = result.messages.find((m) =>
      JSON.stringify(m.content).includes('<structured_state>'),
    )
    expect(preserved).toBeDefined()
  })

  test('preserved-state JSON survives truncation byte-for-byte', () => {
    const compactor = new ContextCompactor({ logger: noopLogger })
    const summaryText =
      '{"todos":[{"task":"implement token service","completed":false}],"readFiles":["src/auth.ts","src/tokens.ts"],"modifiedFiles":["src/auth.ts"],"createdFiles":[],"skills":["coding-typescript"],"fid":"FID-2026-0806-003"}'
    const history = buildHistory(150, 25)
    history[25] = userMsg(
      `<conversation_summary>\n<historical_memory>\n<structured_state>\n## Preserved state\n${summaryText}\n</structured_state>\n</historical_memory>\n</conversation_summary>`,
    )
    const result = compactor.reactiveCompact(history)

    const preserved = result.messages.find(
      (m) =>
        m.role === 'user' &&
        Array.isArray(m.content) &&
        m.content.some(
          (p) => p.type === 'text' && p.text.includes(summaryText),
        ),
    )
    expect(preserved).toBeDefined()
  })

  test('small histories are untouched', () => {
    const compactor = new ContextCompactor({ logger: noopLogger })
    const history = buildHistory(2)
    const result = compactor.reactiveCompact(history)
    expect(result.truncated).toBe(false)
    expect(result.messages).toEqual(history)
  })

  test('preserves a mid-history critical-context message (FID-2026-0806-005 Layer 3)', () => {
    const compactor = new ContextCompactor({ logger: noopLogger })
    const history = buildHistory(100)
    history[45] = userMsg(
      '<!--echo-critical-->\n# ECHO Protocol (condensed refresh)\nLaw 1: read 0-EOF.',
    )
    const result = compactor.reactiveCompact(history)

    expect(result.truncated).toBe(true)
    const preserved = result.messages.find((m) =>
      JSON.stringify(m.content).includes('<!--echo-critical-->'),
    )
    expect(preserved).toBeDefined()
  })
})

describe('ContextCompactor.scoreCompactionEffectiveness (P3b anti-thrash)', () => {
  function makeCompactor(options?: { contextWindow?: number }) {
    return new ContextCompactor({
      logger: noopLogger,
      ...options,
    })
  }

  test('no-op when no compaction was armed (summary-free step never resets the breaker)', () => {
    const compactor = makeCompactor()
    // Not armed: shouldAutoCompact was never called with an over-threshold count.
    compactor.scoreCompactionEffectiveness(50_000)
    // Calling recordCompactionResult with success would reset failureCount to 0;
    // verify the score was a no-op by checking a subsequent failure still
    // counts (i.e. the breaker was NOT reset by the no-op score).
    compactor.recordCompactionResult(false)
    compactor.recordCompactionResult(false)
    compactor.recordCompactionResult(false)
    // Circuit breaker should now be open (3 consecutive failures).
    const check = compactor.shouldAutoCompact(buildHistory(10), 500_000)
    expect(check.shouldCompact).toBe(false)
    expect(check.reason).toContain('Circuit breaker open')
  })

  test('scores success when the real post-response count is under the threshold', () => {
    const compactor = makeCompactor()
    const history = buildHistory(10)
    // Preflight arms a pending score.
    const preflight = compactor.shouldAutoCompact(history, 500_000)
    expect(preflight.shouldCompact).toBe(true)

    // The real post-response count after compaction is well under the
    // threshold → success. This resets the breaker to healthy.
    compactor.scoreCompactionEffectiveness(50_000)

    // A subsequent failure should be the FIRST of a new streak (breaker was
    // reset by the successful score), so two failures do NOT open it.
    compactor.recordCompactionResult(false)
    compactor.recordCompactionResult(false)
    const check = compactor.shouldAutoCompact(history, 500_000)
    // Two failures < 3 → not open yet (success reset the count).
    expect(check.shouldCompact).toBe(true)
  })

  test('scores failure when the real count stays over the threshold (re-compaction loop risk)', () => {
    const compactor = makeCompactor()
    const history = buildHistory(10)
    compactor.shouldAutoCompact(history, 500_000) // arm

    // Real post-response count STILL over threshold → the compaction failed to
    // help; this is the exact Hermes anti-thrash defect the guard prevents.
    compactor.scoreCompactionEffectiveness(480_000)

    // Failure was recorded → breaker counts it. 3 failures total opens it.
    compactor.recordCompactionResult(false)
    compactor.recordCompactionResult(false)
    const check = compactor.shouldAutoCompact(history, 500_000)
    expect(check.shouldCompact).toBe(false)
    expect(check.reason).toContain('Circuit breaker open')
  })

  test('arms a new score only after a fresh preflight crossing', () => {
    const compactor = makeCompactor()
    const history = buildHistory(10)
    compactor.shouldAutoCompact(history, 500_000) // arm
    compactor.scoreCompactionEffectiveness(50_000) // consume -> success

    // Second score without a new preflight is a no-op (flag already cleared).
    compactor.scoreCompactionEffectiveness(480_000) // would be failure if armed

    // The first score reset the breaker; the second was a no-op, so a single
    // failure after it leaves the breaker healthy (not 2/3).
    compactor.recordCompactionResult(false)
    const check = compactor.shouldAutoCompact(history, 500_000)
    expect(check.shouldCompact).toBe(true)
  })
})

describe('ContextCompactor thresholds (FID-2026-0814-012 — reactiveCompact is the resolved window)', () => {
  function thresholdsFor(contextWindow: number) {
    return new ContextCompactor({
      logger: noopLogger,
      contextWindow,
    }).getThresholds()
  }

  test('reactiveCompact always equals the resolved context window', () => {
    // A normal window and the practical floor both resolve exactly.
    expect(thresholdsFor(262_144).reactiveCompact).toBe(262_144)
    expect(thresholdsFor(128_000).reactiveCompact).toBe(128_000)
  })

  test('autoCompact is ratio-governed by the shared resolver (FID-2026-0821-001 P0-3)', () => {
    // The legacy max(W − 30k, 100k) formula made autoCompact + 30k
    // reconstruct the window; P0-3 replaces it with floor(clamp(W × ratio))
    // — so the window itself must always be read from reactiveCompact
    // directly.
    const t = thresholdsFor(262_144)
    expect(t.autoCompact).toBe(209_715)
    expect(t.reactiveCompact).toBe(262_144)
  })

  test('small-window inversion: min side wins, ordering invariant preserved (P0-3)', () => {
    // At 128k the clamp range inverts ((W − 30k) = 98k < floor 100k), so the
    // resolver takes the min side — 98k, not the legacy 100k clamp floor.
    // Ordering invariant holds: window > force > trigger.
    const t = thresholdsFor(128_000)
    expect(t.autoCompact).toBe(98_000)
    expect(t.autoCompact).toBeLessThan(128_000 - 15_000)
    expect(t.reactiveCompact).toBe(128_000)
  })
})

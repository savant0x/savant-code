import fs from 'node:fs'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { useChatStore } from '../chat-store'

import type { CompactionStatus } from '@savant-code/common/types/session-state'

afterEach(() => {
  useChatStore.getState().reset()
})

function setStatus(status: CompactionStatus | null) {
  useChatStore.getState().setCompactionStatus(status)
}

describe('compaction lifecycle store (FID-2026-0814-006)', () => {
  test('a compacting → pruned transition records one run with tokens saved', () => {
    setStatus({ phase: 'compacting' })
    setStatus({ phase: 'pruned', tokensSaved: 4_000, percentUsed: 55 })

    const state = useChatStore.getState()
    expect(state.compactionCount).toBe(1)
    expect(state.compactionEvents).toHaveLength(1)
    expect(state.compactionEvents[0]).toMatchObject({
      outcome: 'pruned',
      tokensSaved: 4_000,
      percentUsed: 55,
    })
    expect(typeof state.compactionEvents[0]?.at).toBe('number')
  })

  test('a compacting → warning transition records an ineffective run', () => {
    setStatus({ phase: 'compacting' })
    setStatus({ phase: 'warning', percentUsed: 92 })

    const state = useChatStore.getState()
    expect(state.compactionCount).toBe(1)
    expect(state.compactionEvents[0]?.outcome).toBe('ineffective')
  })

  test('a bare warning (step-boundary threshold) records nothing', () => {
    setStatus({ phase: 'warning', percentUsed: 90 })
    expect(useChatStore.getState().compactionCount).toBe(0)
    expect(useChatStore.getState().compactionEvents).toHaveLength(0)
  })

  test('repeated status refreshes with no transition never double-count', () => {
    setStatus({ phase: 'compacting' })
    setStatus({ phase: 'pruned', tokensSaved: 2_000 })
    // Heartbeat re-delivers the same terminal status — must not re-record.
    setStatus({ phase: 'pruned', tokensSaved: 2_000 })
    setStatus({ phase: 'pruned', tokensSaved: 2_000 })

    expect(useChatStore.getState().compactionCount).toBe(1)
  })

  test('the bounded history caps at 5 events (long sessions cannot grow the UI)', () => {
    for (let i = 0; i < 7; i++) {
      setStatus({ phase: 'compacting' })
      setStatus({ phase: 'pruned', tokensSaved: 1_000 + i })
    }
    const state = useChatStore.getState()
    expect(state.compactionCount).toBe(7)
    expect(state.compactionEvents).toHaveLength(5)
  })

  test('reset clears the counter and events alongside sidebar data', () => {
    setStatus({ phase: 'compacting' })
    setStatus({ phase: 'pruned', tokensSaved: 3_000 })
    expect(useChatStore.getState().compactionCount).toBe(1)

    useChatStore.getState().reset()

    const state = useChatStore.getState()
    expect(state.compactionCount).toBe(0)
    expect(state.compactionEvents).toHaveLength(0)
    expect(state.compactionStatus).toBeNull()
  })

  test('recordCompactionRun appends an explicit lifecycle event', () => {
    useChatStore.getState().recordCompactionRun({
      outcome: 'pruned',
      tokensSaved: 500,
      at: Date.now(),
    })
    const state = useChatStore.getState()
    expect(state.compactionCount).toBe(1)
    expect(state.compactionEvents[0]?.outcome).toBe('pruned')
  })

  test('runtime-emitted ineffective records verbatim without a predecessor (P1-3)', () => {
    // FID-2026-0821-001 P0-2/P1-3: the runtime now writes an explicit
    // `ineffective` terminal phase; the store records it directly instead of
    // inferring it from a compacting → warning transition.
    setStatus({ phase: 'ineffective', percentUsed: 88 })

    const state = useChatStore.getState()
    expect(state.compactionCount).toBe(1)
    expect(state.compactionEvents[0]).toMatchObject({
      outcome: 'ineffective',
      percentUsed: 88,
    })
  })

  test('a blocked phase surfaces the status but records no lifecycle run', () => {
    setStatus({
      phase: 'blocked',
      blockReason: 'circuit-breaker-open',
      percentUsed: 90,
    })

    const state = useChatStore.getState()
    expect(state.compactionStatus).toMatchObject({
      phase: 'blocked',
      blockReason: 'circuit-breaker-open',
    })
    // A block is persistent panel state, not a completed run — no event.
    expect(state.compactionCount).toBe(0)
  })
})

describe('CompactionSignal durable retirement (FID-2026-0917-006)', () => {
  // Reproduces the operator-reported regression: the panel re-pins after
  // onNewUserMessage because adoptAndPersist + the 2s heartbeat re-mirror
  // mainAgentState.compactionStatus, which retains its terminal phase.
  function mirrorTerminalStatus() {
    // Exactly what adoptAndPersist / send-message-monitors do at run end
    // and on each heartbeat poll: re-deliver the runtime's long-lived
    // terminal status + report verbatim.
    setStatus({ phase: 'compacted', tokensSaved: 1_500, percentUsed: 62 })
  }
  function mirrorTerminalReport() {
    useChatStore.getState().setLastCompactionReport({
      summaryExcerpt: 'removed stale tool results',
      removedMessages: 3,
      tokensSaved: 1_500,
      percentUsed: 62,
    })
  }

  test('onNewUserMessage retires the panel and stamps the outcome epoch', () => {
    setStatus({ phase: 'compacting' })
    setStatus({ phase: 'compacted', tokensSaved: 1_500, percentUsed: 62 })
    mirrorTerminalReport()
    expect(useChatStore.getState().compactionStatus?.phase).toBe('compacted')

    useChatStore.getState().onNewUserMessage()

    const state = useChatStore.getState()
    expect(state.compactionStatus).toBeNull()
    expect(state.compactionEvents).toHaveLength(0)
    expect(state.lastCompactionReport).toBeNull()
    // The compactionCount sidebar stat is preserved (honest accounting).
    expect(state.compactionCount).toBe(1)
    // And the retirement is recorded so mirrors can be suppressed.
    expect(state.retiredCompactionStatusEpoch).not.toBeNull()
  })

  test('a stale re-mirror of the retired status does NOT re-pin the panel', () => {
    setStatus({ phase: 'compacting' })
    setStatus({ phase: 'compacted', tokensSaved: 1_500, percentUsed: 62 })
    mirrorTerminalReport()
    useChatStore.getState().onNewUserMessage()

    // The run-end mirror re-delivers the same terminal status.
    mirrorTerminalStatus()

    const state = useChatStore.getState()
    expect(state.compactionStatus).toBeNull()
    // And it must not resurrect the report excerpt either.
    expect(state.lastCompactionReport).toBeNull()
    // No phantom double-count from the re-delivery.
    expect(state.compactionCount).toBe(1)
  })

  test('a stale re-mirror of the retired report does NOT resurrect the excerpt', () => {
    setStatus({ phase: 'compacting' })
    setStatus({ phase: 'compacted', tokensSaved: 1_500, percentUsed: 62 })
    mirrorTerminalReport()
    useChatStore.getState().onNewUserMessage()

    mirrorTerminalReport()

    expect(useChatStore.getState().lastCompactionReport).toBeNull()
  })

  test('a genuinely new compaction after retirement displays normally', () => {
    setStatus({ phase: 'compacting' })
    setStatus({ phase: 'compacted', tokensSaved: 1_500, percentUsed: 62 })
    mirrorTerminalReport()
    useChatStore.getState().onNewUserMessage()

    // A fresh, different compaction outcome.
    setStatus({ phase: 'compacting' })
    setStatus({ phase: 'pruned', tokensSaved: 9_000, percentUsed: 41 })
    useChatStore.getState().setLastCompactionReport({
      summaryExcerpt: 'a brand new summary',
      removedMessages: 12,
      tokensSaved: 9_000,
      percentUsed: 41,
    })

    const state = useChatStore.getState()
    expect(state.compactionStatus?.phase).toBe('pruned')
    expect(state.lastCompactionReport?.removedMessages).toBe(12)
    expect(state.compactionCount).toBe(2)
    // The prior retirement is cleared — the panel is live again.
    expect(state.retiredCompactionStatusEpoch).toBeNull()
  })

  test('a blocked/warning status is never suppressed by a retirement', () => {
    // Live states are not compaction outcomes: the retirement must not
    // silence a circuit-breaker block or a threshold warning.
    setStatus({ phase: 'compacting' })
    setStatus({ phase: 'compacted', tokensSaved: 500, percentUsed: 70 })
    useChatStore.getState().onNewUserMessage()

    setStatus({
      phase: 'blocked',
      percentUsed: 91,
      blockReason: 'circuit-breaker-open',
    })
    expect(useChatStore.getState().compactionStatus?.phase).toBe('blocked')

    useChatStore.getState().onNewUserMessage()
    setStatus({ phase: 'warning', percentUsed: 88 })
    expect(useChatStore.getState().compactionStatus?.phase).toBe('warning')
  })

  test('session reset clears the retirement stamp', () => {
    setStatus({ phase: 'compacting' })
    setStatus({ phase: 'compacted', tokensSaved: 500, percentUsed: 70 })
    useChatStore.getState().onNewUserMessage()
    expect(useChatStore.getState().retiredCompactionStatusEpoch).not.toBeNull()

    useChatStore.getState().reset()

    expect(useChatStore.getState().retiredCompactionStatusEpoch).toBeNull()
  })
})

describe('CompactionSignal render-only boundary (FID-2026-0814-006)', () => {
  test('the in-stream signal is display-only: no tool, write, or history mutation path', () => {
    const source = fs.readFileSync(
      path.join(import.meta.dir, '../../components/compaction-signal.tsx'),
      'utf8',
    )
    // It must never mutate chat history (would corrupt ECHO compliance
    // accounting) and must never dispatch tools or write files.
    expect(source).not.toContain('setMessages')
    expect(source).not.toContain('messageHistory.push')
    expect(source).not.toContain('tool-executor')
    expect(source).not.toContain('executeToolCall')
    expect(source).not.toContain('write_file')
    expect(source).not.toContain('str_replace')
    expect(source).not.toContain('run_terminal_command')
    expect(source).not.toContain('import(')
  })
})

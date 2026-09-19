import { afterEach, describe, expect, test } from 'bun:test'

import { useChatStore } from '../chat-store'

import type { CompactionStatus } from '@savant-code/common/types/session-state'

afterEach(() => {
  useChatStore.getState().reset()
})

function setStatus(status: CompactionStatus | null) {
  useChatStore.getState().setCompactionStatus(status)
}

describe('CompactionSignal durable retirement (FID-2026-0918-004)', () => {
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

  test('onNewUserMessage retires the panel and arms the retirement', () => {
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
    // And the retirement is armed with the outgoing values so mirrors can be
    // suppressed by equality.
    expect(state.compactionSignalRetired).toBe(true)
    expect(state.retiredCompactionStatus).toMatchObject({
      phase: 'compacted',
      tokensSaved: 1_500,
    })
    expect(state.retiredCompactionReport).toMatchObject({ removedMessages: 3 })
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
    expect(state.compactionSignalRetired).toBe(false)
    expect(state.retiredCompactionStatus).toBeNull()
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

  test('a live phase in the next run does NOT end the retirement (FID-2026-0918-004 live-phase hole)', () => {
    // The FID-2026-0917-006 epoch scheme returned null for every live phase,
    // so the ordinary post-compaction regime (context still over threshold →
    // every subsequent run ends on `warning`) stamped a null that suppressed
    // nothing, and the run-end mirror resurrected the terminal panel below
    // every later message. Regression guard for exactly that chain.
    setStatus({ phase: 'compacting' })
    setStatus({ phase: 'compacted', tokensSaved: 1_500, percentUsed: 62 })
    mirrorTerminalReport()
    useChatStore.getState().onNewUserMessage()
    expect(useChatStore.getState().compactionSignalRetired).toBe(true)

    // Next run, first step: context still over the threshold → live warning.
    setStatus({ phase: 'warning', percentUsed: 95 })
    // The live state lands as the current status, but the retirement MUST
    // stay armed (it is not an outcome).
    expect(useChatStore.getState().compactionStatus?.phase).toBe('warning')
    expect(useChatStore.getState().compactionSignalRetired).toBe(true)

    // The stale seed status re-mirrored by the heartbeat / adoptAndPersist
    // is still suppressed → no re-pin, no phantom double-count.
    mirrorTerminalStatus()
    const state = useChatStore.getState()
    expect(state.compactionStatus?.phase).toBe('warning')
    expect(state.lastCompactionReport).toBeNull()
    expect(state.compactionCount).toBe(1)
  })

  test('a report arriving while armed is deferred, not stored (report-lateness hole)', () => {
    // The micro-compact report can arrive only via adoptAndPersist at run
    // end, AFTER the next onNewUserMessage has armed the retirement with a
    // null report half. Accepting it would resurrect the excerpt with no
    // status to justify it; deferring is lossless (the next mirror lands it
    // once a terminal status ends the retirement).
    setStatus({ phase: 'compacting' })
    setStatus({ phase: 'compacted', tokensSaved: 1_500, percentUsed: 62 })
    useChatStore.getState().onNewUserMessage()

    // A report that differs from the (null) retired half.
    useChatStore.getState().setLastCompactionReport({
      summaryExcerpt: 'late-arriving report',
      removedMessages: 2,
      tokensSaved: 800,
      percentUsed: 60,
    })
    expect(useChatStore.getState().lastCompactionReport).toBeNull()
    expect(useChatStore.getState().compactionSignalRetired).toBe(true)
  })

  test('a percent-drifting remirror of the retired terminal status does NOT re-pin (FID-2026-0919-017)', () => {
    // The operator-reported re-pin: the heartbeat/adoptAndPersist remirror
    // re-derived `percentUsed` (62 → 64) on a window recount. The old
    // sameCompactionStatus drop compared the drifting field and missed, so
    // the remirror ended the retirement as a "new" outcome and re-pinned the
    // panel above the input. Outcome identity (phase:tokensSaved) is
    // percent-blind by design.
    setStatus({ phase: 'compacting' })
    setStatus({ phase: 'compacted', tokensSaved: 1_500, percentUsed: 62 })
    mirrorTerminalReport()
    useChatStore.getState().onNewUserMessage()
    expect(useChatStore.getState().compactionSignalRetired).toBe(true)

    // Same terminal outcome, drifted percent — must be dropped.
    setStatus({ phase: 'compacted', tokensSaved: 1_500, percentUsed: 64 })
    const state = useChatStore.getState()
    expect(state.compactionStatus).toBeNull()
    expect(state.lastCompactionReport).toBeNull()
    // No phantom double-count from the re-delivery.
    expect(state.compactionCount).toBe(1)
    // The retirement stays armed for further mirrors.
    expect(state.compactionSignalRetired).toBe(true)
  })

  test('a drifted live warning after retirement still lands (identity-drop guard)', () => {
    // Counter-guard for the identity drop: a retired LIVE half plus a NEW
    // live warning (different percent) must not be swallowed by a
    // null===null epoch match. Live states are never outcomes.
    setStatus({ phase: 'warning', percentUsed: 88 })
    useChatStore.getState().onNewUserMessage()
    expect(useChatStore.getState().compactionSignalRetired).toBe(true)

    setStatus({ phase: 'warning', percentUsed: 95 })
    expect(useChatStore.getState().compactionStatus?.phase).toBe('warning')
    expect(useChatStore.getState().compactionStatus?.percentUsed).toBe(95)
    // Retirement persists — a live phase never ends it.
    expect(useChatStore.getState().compactionSignalRetired).toBe(true)
  })

  test('session reset clears the retirement', () => {
    setStatus({ phase: 'compacting' })
    setStatus({ phase: 'compacted', tokensSaved: 500, percentUsed: 70 })
    useChatStore.getState().onNewUserMessage()
    expect(useChatStore.getState().compactionSignalRetired).toBe(true)

    useChatStore.getState().reset()

    const state = useChatStore.getState()
    expect(state.compactionSignalRetired).toBe(false)
    expect(state.retiredCompactionStatus).toBeNull()
    expect(state.retiredCompactionReport).toBeNull()
  })
})

import { describe, expect, test } from 'bun:test'

import { STATE_SNAPSHOT_INTERVAL_MS } from '../../types'
import { startStateSnapshotting } from '../snapshot'

import type { RunState } from '../../../run-state'
import type { SessionState } from '@savant-code/common/types/session-state'

function makeSessionState(): SessionState {
  return {
    mainAgentState: {
      agentId: 'test-agent',
      agentType: 'main',
      agentContext: {},
      ancestorRunIds: [],
      runId: 'run-1',
      subagents: [],
      childRunIds: [],
      messageHistory: [
        { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      ],
      stepsRemaining: 10,
      creditsUsed: 0,
      directCreditsUsed: 0,
      systemPrompt: '',
      toolDefinitions: {},
      contextTokenCount: 1_000,
      maxContextLength: 200_000,
    },
  } as unknown as SessionState
}

const getCancelledRunState = (message: string): RunState =>
  ({ output: { type: 'error', message } }) as unknown as RunState

describe('startStateSnapshotting (FID-2026-0814-006 freshness)', () => {
  test('skips ticks when nothing observable changed (identity-skip preserved)', () => {
    const sessionState = makeSessionState()
    let emitted = 0
    const { emit, stop } = startStateSnapshotting({
      sessionState,
      getCancelledRunState,
      onStateSnapshot: () => {
        emitted++
      },
    })
    try {
      // First emit fires immediately; unchanged state does not re-emit.
      const afterFirst = emitted
      emit()
      emit()
      expect(emitted).toBe(afterFirst)
    } finally {
      stop()
    }
  })

  test('emits when compactionStatus changes without a history identity change', () => {
    const sessionState = makeSessionState()
    let emitted = 0
    const { emit, stop } = startStateSnapshotting({
      sessionState,
      getCancelledRunState,
      onStateSnapshot: () => {
        emitted++
      },
    })
    try {
      const before = emitted
      // Runtime writes a fresh compactionStatus object (e.g. pruner
      // completion) while messageHistory identity is unchanged.
      sessionState.mainAgentState.compactionStatus = {
        phase: 'pruned',
        tokensSaved: 4_000,
        percentUsed: 55,
      }
      emit()
      expect(emitted).toBe(before + 1)
      // Same object again → no re-emit.
      emit()
      expect(emitted).toBe(before + 1)
    } finally {
      stop()
    }
  })

  test('emits when contextTokenCount changes without a history identity change', () => {
    const sessionState = makeSessionState()
    let emitted = 0
    const { emit, stop } = startStateSnapshotting({
      sessionState,
      getCancelledRunState,
      onStateSnapshot: () => {
        emitted++
      },
    })
    try {
      const before = emitted
      sessionState.mainAgentState.contextTokenCount = 150_000
      emit()
      expect(emitted).toBe(before + 1)
    } finally {
      stop()
    }
  })

  test('emits once when both history and status changed in the same tick', () => {
    const sessionState = makeSessionState()
    let emitted = 0
    const { emit, stop } = startStateSnapshotting({
      sessionState,
      getCancelledRunState,
      onStateSnapshot: () => {
        emitted++
      },
    })
    try {
      const before = emitted
      sessionState.mainAgentState.messageHistory = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'reply' }],
        },
      ]
      sessionState.mainAgentState.compactionStatus = { phase: 'idle' }
      emit()
      expect(emitted).toBe(before + 1)
    } finally {
      stop()
    }
  })

  test('interval keeps ticking while stopped is false', () => {
    // The unref'd interval must not keep the test process alive; the stop()
    // guard above covers that. This asserts stop() actually halts emission.
    const sessionState = makeSessionState()
    let emitted = 0
    const { emit, stop } = startStateSnapshotting({
      sessionState,
      getCancelledRunState,
      onStateSnapshot: () => {
        emitted++
      },
    })
    stop()
    const before = emitted
    emit()
    emit()
    expect(emitted).toBe(before)
  })
})

// The interval constant must be reasonable for the freshness contract.
test('snapshot interval is a positive bounded constant', () => {
  expect(STATE_SNAPSHOT_INTERVAL_MS).toBeGreaterThan(0)
  expect(STATE_SNAPSHOT_INTERVAL_MS).toBeLessThanOrEqual(10_000)
})

/**
 * FID-2026-0815-015 (F-2) — the idle heartbeat must never throw against a
 * frozen/finalised `agentState`, and the run loop must be able to disarm it
 * on every exit path.
 */
import {
  getInitialSessionState,
  type AgentActivity,
  type AgentState,
} from '@savant-code/common/types/session-state'
import { getStubProjectFileContext } from '@savant-code/common/util/file'
import { describe, expect, it } from 'bun:test'

import {
  bumpActivityIdleTimer,
  clearActivityIdleTimer,
} from '../activity-tracking'

function makeAgentState(): AgentState {
  return getInitialSessionState(getStubProjectFileContext()).mainAgentState
}

const THINKING: AgentActivity = { kind: 'thinking', startedAt: Date.now() }

describe('bumpActivityIdleTimer (FID-2026-0815-015)', () => {
  it('arms a timer that idles the state after the timeout', async () => {
    const agentState = makeAgentState()
    agentState.activity = THINKING

    bumpActivityIdleTimer(agentState, 1)
    expect(agentState.activityIdleTimer).toBeDefined()

    await new Promise((resolve) => setTimeout(resolve, 25))
    // Widen past the `thinking` assignment narrowing so the idle assertion
    // is checked against the full discriminated union.
    expect((agentState.activity as AgentActivity | undefined)?.kind).toBe(
      'idle',
    )
    expect(agentState.activityIdleTimer).toBeUndefined()
  })

  it('does NOT throw when the heartbeat fires against a frozen agentState', async () => {
    const agentState = makeAgentState()
    agentState.activity = THINKING
    bumpActivityIdleTimer(agentState, 1)

    // Simulate the immer-auto-frozen zustand store state that triggered the
    // confirmed "Attempted to assign to readonly property" crash.
    Object.freeze(agentState)

    // If the guarded callback re-threw, this would surface as an uncaught
    // exception and fail the whole test process.
    await new Promise((resolve) => setTimeout(resolve, 25))

    // The frozen state must be left untouched (the mutation was swallowed).
    expect(agentState.activity?.kind).toBe('thinking')
  })
})

describe('clearActivityIdleTimer (FID-2026-0815-015)', () => {
  it('disarms a pending heartbeat on a live state', () => {
    const agentState = makeAgentState()
    bumpActivityIdleTimer(agentState, 50_000)
    expect(agentState.activityIdleTimer).toBeDefined()

    clearActivityIdleTimer(agentState)
    expect(agentState.activityIdleTimer).toBeUndefined()
  })

  it('does NOT throw when the state is already frozen', () => {
    const agentState = makeAgentState()
    bumpActivityIdleTimer(agentState, 50_000)
    Object.freeze(agentState)

    // Must not throw even though the assignment to activityIdleTimer is
    // blocked by the freeze.
    expect(() => clearActivityIdleTimer(agentState)).not.toThrow()
  })

  it('is a no-op when no timer is armed', () => {
    const agentState = makeAgentState()
    expect(() => clearActivityIdleTimer(agentState)).not.toThrow()
  })
})

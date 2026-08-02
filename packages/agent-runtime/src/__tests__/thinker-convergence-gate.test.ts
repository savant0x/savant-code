import { createTestAgentRuntimeParams } from '@savant-code/common/testing/fixtures/agent-runtime'
import { getInitialAgentState } from '@savant-code/common/types/session-state'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import {
  MAX_CONSECUTIVE_RETRIES,
  clearThinkerConvergenceStateForTests,
  runThinkerConvergenceGate,
} from '../tools/thinker-convergence-gate'
import {
  clearAllThoughtSessionsForTests,
  getThoughtSession,
} from '../tools/thought-session-store'

import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { AgentState } from '@savant-code/common/types/session-state'

const RUN_ID = 'thinker-gate-test-run'

function createGateAgentState(): AgentState {
  const state = getInitialAgentState()
  return {
    ...state,
    agentId: 'thinker-agent',
    runId: RUN_ID,
    messageHistory: [],
    output: undefined,
  }
}

function getLogger(): Logger {
  const { logger } = createTestAgentRuntimeParams()
  return logger
}

describe('runThinkerConvergenceGate (FID-2026-0801-012)', () => {
  beforeEach(() => {
    clearAllThoughtSessionsForTests()
    clearThinkerConvergenceStateForTests()
  })

  afterEach(() => {
    clearAllThoughtSessionsForTests()
    clearThinkerConvergenceStateForTests()
  })

  it('finalizes a converged session into a non-null success artifact', () => {
    const agentState = createGateAgentState()
    const session = getThoughtSession(RUN_ID)
    session.processThought({
      thought: 'Step one',
      thoughtNumber: 1,
      totalThoughts: 2,
      nextThoughtNeeded: true,
    })
    session.processThought({
      thought: 'Conclusion: use the hybrid approach.',
      thoughtNumber: 2,
      totalThoughts: 2,
      nextThoughtNeeded: false,
    })

    const result = runThinkerConvergenceGate({
      runId: RUN_ID,
      agentState,
      shouldEndTurn: true,
      logger: getLogger(),
    })

    expect(result.terminal).toBe(true)
    expect(result.retryAppended).toBe(false)
    expect(agentState.output).toBeDefined()
    expect(agentState.output?.status).toBe('success')
    const payload = agentState.output?.payload as { message: string } | null
    expect(payload?.message).toBe('Conclusion: use the hybrid approach.')
    const thoughts = agentState.output?.thoughts as unknown[]
    expect(thoughts).toHaveLength(2)
  })

  it('does nothing mid-reasoning (shouldEndTurn=false)', () => {
    const agentState = createGateAgentState()
    const session = getThoughtSession(RUN_ID)
    session.processThought({
      thought: 'Still thinking',
      thoughtNumber: 1,
      totalThoughts: 5,
      nextThoughtNeeded: true,
    })

    const result = runThinkerConvergenceGate({
      runId: RUN_ID,
      agentState,
      shouldEndTurn: false,
      logger: getLogger(),
    })

    expect(result.terminal).toBe(false)
    expect(result.retryAppended).toBe(false)
    expect(agentState.output).toBeUndefined()
    expect(agentState.messageHistory).toHaveLength(0)
  })

  it('appends a retry message when thoughts exist but the turn ended unconverged', () => {
    const agentState = createGateAgentState()
    const session = getThoughtSession(RUN_ID)
    session.processThought({
      thought: 'Analysis only, no conclusion flag',
      thoughtNumber: 1,
      totalThoughts: 3,
      nextThoughtNeeded: true,
    })

    const result = runThinkerConvergenceGate({
      runId: RUN_ID,
      agentState,
      shouldEndTurn: true,
      logger: getLogger(),
    })

    expect(result.terminal).toBe(false)
    expect(result.retryAppended).toBe(true)
    expect(agentState.output).toBeUndefined()
    expect(agentState.messageHistory.length).toBe(1)
    expect(JSON.stringify(agentState.messageHistory[0]!.content)).toContain(
      'nextThoughtNeeded=false',
    )
  })

  it('appends a retry message when no thoughts were accepted', () => {
    const agentState = createGateAgentState()

    const result = runThinkerConvergenceGate({
      runId: RUN_ID,
      agentState,
      shouldEndTurn: true,
      logger: getLogger(),
    })

    expect(result.retryAppended).toBe(true)
    expect(agentState.output).toBeUndefined()
    expect(JSON.stringify(agentState.messageHistory[0]!.content)).toContain(
      'sequentialthinking',
    )
  })

  it('reaches failed after the retry cap with no accepted thoughts', () => {
    const agentState = createGateAgentState()

    for (let attempt = 1; attempt < MAX_CONSECUTIVE_RETRIES; attempt++) {
      const result = runThinkerConvergenceGate({
        runId: RUN_ID,
        agentState,
        shouldEndTurn: true,
        logger: getLogger(),
      })
      expect(result.terminal).toBe(false)
      expect(result.retryAppended).toBe(true)
    }

    const final = runThinkerConvergenceGate({
      runId: RUN_ID,
      agentState,
      shouldEndTurn: true,
      logger: getLogger(),
    })
    expect(final.terminal).toBe(true)
    expect(final.retryAppended).toBe(false)
    expect(agentState.output?.status).toBe('failed')
    expect(agentState.output?.payload).toBeNull()
    expect(typeof agentState.output?.error).toBe('string')
  })

  it('reaches exhausted after the retry cap with accepted but unconverged thoughts', () => {
    const agentState = createGateAgentState()
    const session = getThoughtSession(RUN_ID)
    session.processThought({
      thought: 'Partial reasoning',
      thoughtNumber: 1,
      totalThoughts: 4,
      nextThoughtNeeded: true,
    })

    for (let attempt = 1; attempt < MAX_CONSECUTIVE_RETRIES; attempt++) {
      const result = runThinkerConvergenceGate({
        runId: RUN_ID,
        agentState,
        shouldEndTurn: true,
        logger: getLogger(),
      })
      expect(result.retryAppended).toBe(true)
    }

    const final = runThinkerConvergenceGate({
      runId: RUN_ID,
      agentState,
      shouldEndTurn: true,
      logger: getLogger(),
    })
    expect(final.terminal).toBe(true)
    expect(agentState.output?.status).toBe('exhausted')
    expect(agentState.output?.payload).toBeNull()
    // Partial synthesis preserved
    expect(agentState.output?.synthesis).toBe('Partial reasoning')
    const thoughts = agentState.output?.thoughts as unknown[]
    expect(thoughts).toHaveLength(1)
  })

  it('sets output before terminal so the loop restart check can never fire for the Thinker', () => {
    // Every terminal path (success/exhausted/failed) must populate
    // agentState.output — the loop's `output === undefined && shouldEndTurn`
    // branch would otherwise inject the "You must use set_output" restart.
    const agentState = createGateAgentState()

    const final = runThinkerConvergenceGate({
      runId: RUN_ID,
      agentState,
      shouldEndTurn: true,
      logger: getLogger(),
    })
    expect(final.terminal).toBe(false)

    // Force exhaustion to a terminal state and verify output is always set.
    // The initial call above consumed one consecutive-retry slot, so only
    // MAX-1 additional retries fit before the terminal call.
    for (let attempt = 1; attempt < MAX_CONSECUTIVE_RETRIES - 1; attempt++) {
      runThinkerConvergenceGate({
        runId: RUN_ID,
        agentState,
        shouldEndTurn: true,
        logger: getLogger(),
      })
    }
    const exhausted = runThinkerConvergenceGate({
      runId: RUN_ID,
      agentState,
      shouldEndTurn: true,
      logger: getLogger(),
    })
    expect(exhausted.terminal).toBe(true)
    expect(agentState.output).toBeDefined()
  })
})

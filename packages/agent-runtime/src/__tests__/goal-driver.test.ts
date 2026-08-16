/**
 * FID-2026-0814-002 — goal continuation driver tests. The driver takes a
 * `loopFn` dependency-injection seam; the fake mutates
 * `params.agentState.goal` exactly the way the real runtime's `update_goal`
 * handler does, so the driver's turn-boundary decisions (continue / stop /
 * budget-over / cap / abort) are exercised without a live LLM.
 */
import { describe, expect, test } from 'bun:test'

import { driveGoalTurns } from '../run-agent-step/goal-driver'
import { createGoalRecord } from '../run-agent-step/goal-engine'

import type {
  LoopAgentStepsParams,
  LoopAgentStepsResult,
} from '../run-agent-step/types'
import type { AgentState } from '@savant-code/common/types/session-state'

const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

type MockLoopFn = (
  params: LoopAgentStepsParams,
) => Promise<LoopAgentStepsResult>

function makeParams(agentState: AgentState, signal?: AbortSignal) {
  return {
    agentState,
    logger: noopLogger,
    signal: signal ?? new AbortController().signal,
    prompt: 'original user prompt',
  } as unknown as LoopAgentStepsParams
}

function makeAgentState(goal?: AgentState['goal']): AgentState {
  return {
    agentId: 'main-agent',
    agentType: 'savant',
    agentContext: {},
    ancestorRunIds: [],
    subagents: [],
    childRunIds: [],
    messageHistory: [],
    stepsRemaining: 40,
    creditsUsed: 0,
    directCreditsUsed: 0,
    systemPrompt: '',
    toolDefinitions: {},
    contextTokenCount: 0,
    ...(goal ? { goal } : {}),
  }
}

describe('driveGoalTurns', () => {
  test('runs continuation turns while active and stops on complete', async () => {
    // Real now — an epoch anchor would trip the wall-clock hard cap, because
    // the driver computes budgets against Date.now() between turns.
    const goal = createGoalRecord({ objective: 'ship it', now: Date.now() })
    const agentState = makeAgentState(goal)
    const prompts: Array<string | undefined> = []

    let turn = 0
    const loopFn: MockLoopFn = async (params) => {
      turn += 1
      prompts.push(params.prompt)
      const st = params.agentState as AgentState
      if (turn === 1) {
        st.directCreditsUsed = 100 // simulate a credits-using turn
        // Model keeps working — goal stays active.
      } else {
        // Model completes via update_goal → record cleared.
        st.goal = undefined
      }
      return { agentState: st, output: { type: 'lastMessage', value: [] } }
    }

    await driveGoalTurns(makeParams(agentState), loopFn)

    expect(prompts).toHaveLength(2)
    // Turn 1: the original prompt (no continuation marker).
    expect(prompts[0]).toBe('original user prompt')
    // Turn 2: literal continuation prompt with the untrusted-objective boundary.
    expect(prompts[1]).toContain('[Goal continuation — turn 2]')
    expect(prompts[1]).toContain(
      '<untrusted_objective>ship it</untrusted_objective>',
    )
    // Turn accounting folded at the boundary.
    expect(goal.turnsUsed).toBe(1)
    expect(goal.tokensUsed).toBe(100)
  })

  test('budget over after the first turn marks blocked and stops', async () => {
    const goal = createGoalRecord({
      objective: 'x',
      budgetTurns: 1,
      now: Date.now(),
    })
    const agentState = makeAgentState(goal)
    const loopFn: MockLoopFn = async () => ({
      agentState,
      output: { type: 'lastMessage', value: [] },
    })

    await driveGoalTurns(makeParams(agentState), loopFn)

    expect(goal.status).toBe('blocked')
    expect(goal.terminalReason).toMatch(/turn budget exceeded/)
  })

  test('an abort stops cleanly and leaves the goal active (never blocked)', async () => {
    const controller = new AbortController()
    const goal = createGoalRecord({ objective: 'x', now: Date.now() })
    const agentState = makeAgentState(goal)
    const loopFn: MockLoopFn = async () => {
      controller.abort() // the run is interrupted mid-turn
      return { agentState, output: { type: 'lastMessage', value: [] } }
    }

    await driveGoalTurns(makeParams(agentState, controller.signal), loopFn)

    expect(goal.status).toBe('active')
    expect(goal.terminalReason).toBeUndefined()
  })

  test('continuation cap marks blocked (ECHO circuit breaker)', async () => {
    const goal = createGoalRecord({ objective: 'x', now: Date.now() })
    const agentState = makeAgentState(goal)
    const calls: unknown[] = []
    const loopFn: MockLoopFn = async (params) => {
      calls.push(params.prompt)
      return { agentState, output: { type: 'lastMessage', value: [] } }
    }

    await driveGoalTurns(makeParams(agentState), loopFn)

    // 1 original turn + GOAL_MAX_CONTINUATION_TURNS continuation turns.
    expect(calls).toHaveLength(41)
    expect(goal.status).toBe('blocked')
    expect(goal.terminalReason).toMatch(/Continuation cap reached/)
  })
})

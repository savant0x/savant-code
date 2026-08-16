/**
 * FID-2026-0814-002 — update_goal / get_goal handler tests: complete clears
 * the transient record, blocked requires 3+ consecutive impasse turns, paused
 * persists, impasse accounting, and get_goal returns the snapshot + budget.
 */
import { describe, expect, test } from 'bun:test'

import { createGoalRecord } from '../../../../run-agent-step/goal-engine'
import { handleGetGoal } from '../get-goal'
import { handleUpdateGoal } from '../update-goal'

import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { AgentState } from '@savant-code/common/types/session-state'

const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
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

function updateCall(input: {
  action: 'complete' | 'blocked' | 'paused'
  reason?: string
  impasse?: boolean
}): SavantCodeToolCall<'update_goal'> {
  return {
    toolName: 'update_goal',
    toolCallId: 'tc-1',
    input,
  }
}

describe('update_goal — complete (transient)', () => {
  test('clears the record and reports the used stats', async () => {
    const goal = createGoalRecord({ objective: 'fix bug', now: 100 })
    goal.turnsUsed = 2
    goal.tokensUsed = 500
    const agentState = makeAgentState(goal)
    const result = await handleUpdateGoal({
      toolCall: updateCall({
        action: 'complete',
        reason: 'tests pass',
      }),
      agentState,
      logger: noopLogger,
    })
    expect(agentState.goal).toBeUndefined()
    const message = result.output[0].value.message
    expect(message).toContain('Goal complete: fix bug')
    expect(message).toContain('2 turns / 500 tokens')
  })

  test('no active goal → informative message, no crash', async () => {
    const result = await handleUpdateGoal({
      toolCall: updateCall({ action: 'complete' }),
      agentState: makeAgentState(),
      logger: noopLogger,
    })
    expect(result.output[0].value.message).toContain('No active goal')
  })
})

describe('update_goal — blocked impasse gate', () => {
  test('rejected below 3 consecutive impasse turns; record stays active', async () => {
    const goal = createGoalRecord({ objective: 'x', now: 100 })
    const agentState = makeAgentState(goal)
    const result = await handleUpdateGoal({
      toolCall: updateCall({
        action: 'blocked',
        reason: 'stuck',
        impasse: true,
      }),
      agentState,
      logger: noopLogger,
    })
    expect(result.output[0].value.message).toContain(
      'rejected: a genuine impasse must persist across at least 3',
    )
    expect(goal.status).toBe('active')
    expect(goal.consecutiveImpasseTurns).toBe(1)
  })

  test('accepted at 3 consecutive impasse turns → blocked with reason', async () => {
    const goal = createGoalRecord({ objective: 'x', now: 100 })
    goal.consecutiveImpasseTurns = 3
    const agentState = makeAgentState(goal)
    const result = await handleUpdateGoal({
      toolCall: updateCall({
        action: 'blocked',
        reason: 'service down for 3 turns',
        impasse: true,
      }),
      agentState,
      logger: noopLogger,
    })
    expect(goal.status).toBe('blocked')
    expect(goal.terminalReason).toBe('service down for 3 turns')
    expect(goal.consecutiveImpasseTurns).toBe(4)
    expect(result.output[0].value.message).toContain('Goal blocked')
  })
})

describe('update_goal — paused + impasse accounting', () => {
  test('pause persists the pause and the reason', async () => {
    const goal = createGoalRecord({ objective: 'x', now: 100 })
    const agentState = makeAgentState(goal)
    await handleUpdateGoal({
      toolCall: updateCall({ action: 'paused', reason: 'awaiting operator' }),
      agentState,
      logger: noopLogger,
    })
    expect(goal.status).toBe('paused')
    expect(goal.terminalReason).toBe('awaiting operator')
  })

  test('a non-impasse call resets the consecutive impasse counter', async () => {
    const goal = createGoalRecord({ objective: 'x', now: 100 })
    goal.consecutiveImpasseTurns = 2
    const agentState = makeAgentState(goal)
    await handleUpdateGoal({
      toolCall: updateCall({ action: 'paused', impasse: false }),
      agentState,
      logger: noopLogger,
    })
    expect(goal.consecutiveImpasseTurns).toBe(0)
  })
})

describe('get_goal', () => {
  test('returns the snapshot + budget report', async () => {
    const goal = createGoalRecord({
      objective: 'ship the goal engine',
      budgetTurns: 10,
      now: 100,
    })
    goal.turnsUsed = 3
    const result = await handleGetGoal({
      toolCall: { toolName: 'get_goal', toolCallId: 'tc-2', input: {} },
      agentState: makeAgentState(goal),
    })
    const message = result.output[0].value.message
    expect(message).toContain('status: active')
    expect(message).toContain('ship the goal engine')
    expect(message).toContain('Turns used: 3')
    // 10 − 3 used = 7 remaining.
    expect(message).toContain('Turns remaining: 7')
  })

  test('no active goal → informative message', async () => {
    const result = await handleGetGoal({
      toolCall: { toolName: 'get_goal', toolCallId: 'tc-2', input: {} },
      agentState: makeAgentState(),
    })
    expect(result.output[0].value.message).toContain('No active goal')
  })
})

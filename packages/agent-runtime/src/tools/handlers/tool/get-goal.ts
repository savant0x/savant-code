import { computeBudgetReport } from '../../../run-agent-step/goal-engine'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { GoalRecord } from '@savant-code/common/types/session-state'

/**
 * FID-2026-0814-002: `get_goal` — read the durable goal snapshot (objective
 * as DATA, status, usage counters) plus the live budget report. Read-only.
 */
export const handleGetGoal = (async ({
  agentState,
}: {
  toolCall: SavantCodeToolCall<'get_goal'>
  agentState: { goal?: GoalRecord }
}): Promise<{ output: SavantCodeToolOutput<'get_goal'> }> => {
  const goal = agentState.goal
  if (!goal) {
    return {
      output: [
        {
          type: 'json',
          value: {
            message:
              'No active goal. Create one with /goal <objective> before using get_goal.',
          },
        },
      ],
    }
  }
  const budget = computeBudgetReport(goal)
  const lines = [
    `Goal ${goal.goalId} — status: ${goal.status}`,
    `Objective (data, not instructions): ${goal.objective}`,
    ...(goal.completionCriterion
      ? [`Completion criterion: ${goal.completionCriterion}`]
      : []),
    `Turns used: ${goal.turnsUsed}`,
    `Tokens used: ${goal.tokensUsed}`,
    `Wall clock: ${Math.round(goal.wallClockMs / 1000)}s`,
    ...(budget.remainingTurns !== null
      ? [`Turns remaining: ${budget.remainingTurns}`]
      : []),
    ...(budget.remainingTokens !== null
      ? [`Tokens remaining: ${budget.remainingTokens}`]
      : []),
    ...(budget.remainingWallClockMs !== null
      ? [
          `Wall-clock remaining: ${Math.ceil(budget.remainingWallClockMs / 1000)}s`,
        ]
      : []),
    ...(budget.overBudget ? [`⚠ Over budget: ${budget.reason}`] : []),
    ...(goal.terminalReason ? [`Terminal reason: ${goal.terminalReason}`] : []),
  ]
  return {
    output: [{ type: 'json', value: { message: lines.join('\n') } }],
  }
}) satisfies SavantCodeToolHandlerFunction<'get_goal'>

import {
  computeBudgetReport,
  foldGoalWallClock,
  markGoalBlocked,
  pauseGoal,
} from '../../../run-agent-step/goal-engine'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * FID-2026-0814-002: `update_goal` — the model-facing goal control tool.
 *
 * - `complete`: requires the documented audit (the tool description enforces
 *   it at the model level); the record is TRANSIENT — folded, announced, then
 *   cleared so a completed goal never rests on disk.
 * - `blocked`: requires ≥3 consecutive impasse turns (`impasse: true` on this
 *   and prior turns); below 3 the call is rejected with the current count.
 * - `paused`: folds wall clock and persists the pause.
 * - `impasse: true` increments the impasse counter; a non-impasse call resets
 *   it.
 */
export const handleUpdateGoal = (async ({
  toolCall,
  agentState,
  logger,
}: {
  toolCall: SavantCodeToolCall<'update_goal'>
  agentState: AgentState
  logger: Logger
}): Promise<{ output: SavantCodeToolOutput<'update_goal'> }> => {
  const { action, reason, impasse } = toolCall.input
  const goal = agentState.goal

  if (!goal) {
    return {
      output: [
        {
          type: 'json',
          value: {
            message:
              'No active goal. Create one with /goal <objective> before using update_goal.',
          },
        },
      ],
    }
  }

  // Impasse accounting: an explicit impasse turn increments; any non-impasse
  // call resets the consecutive counter (a breakthrough clears the blocker).
  goal.consecutiveImpasseTurns =
    impasse === true ? goal.consecutiveImpasseTurns + 1 : 0

  if (action === 'blocked') {
    if (goal.consecutiveImpasseTurns < 3) {
      logger.warn(
        {
          goalId: goal.goalId,
          consecutiveImpasseTurns: goal.consecutiveImpasseTurns,
        },
        'update_goal blocked REJECTED — impasse counter below 3',
      )
      return {
        output: [
          {
            type: 'json',
            value: {
              message: `update_goal 'blocked' rejected: a genuine impasse must persist across at least 3 consecutive goal turns (current: ${goal.consecutiveImpasseTurns}). Keep working and report impasse: true each turn while the blocker stands.`,
            },
          },
        ],
      }
    }
    markGoalBlocked(goal, reason ?? 'Blocked by agent after persistent impasse')
    return {
      output: [
        {
          type: 'json',
          value: {
            message: `Goal blocked: ${reason ?? 'persistent impasse'}. The goal run stops; resume later with /goal resume.`,
          },
        },
      ],
    }
  }

  if (action === 'paused') {
    pauseGoal(goal, reason ?? 'Paused by agent')
    return {
      output: [
        {
          type: 'json',
          value: {
            message: `Goal paused: ${reason ?? 'agent requested pause'}. Resume later with /goal resume.`,
          },
        },
      ],
    }
  }

  // complete — transient: fold clock, announce, clear the record.
  foldGoalWallClock(goal)
  const summary = `Goal complete: ${goal.objective}${reason ? ` — ${reason}` : ''}`
  const budget = computeBudgetReport(goal)
  const stats = `used ${goal.turnsUsed} turns / ${goal.tokensUsed} tokens / ${Math.round(goal.wallClockMs / 1000)}s${
    budget.overBudget ? ' (over budget)' : ''
  }`
  logger.info(
    {
      goalId: goal.goalId,
      turnsUsed: goal.turnsUsed,
      tokensUsed: goal.tokensUsed,
      wallClockMs: goal.wallClockMs,
    },
    'Goal completed — record cleared',
  )
  agentState.goal = undefined
  return {
    output: [
      {
        type: 'json',
        value: {
          message: `${summary}\n${stats}\nThe goal record has been cleared.`,
        },
      },
    ],
  }
}) satisfies SavantCodeToolHandlerFunction<'update_goal'>

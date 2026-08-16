import {
  GOAL_MAX_CONTINUATION_TURNS,
  buildGoalContinuationPrompt,
  computeBudgetReport,
  markGoalBlocked,
} from './goal-engine'
import { loopAgentSteps } from './loop'

import type { LoopAgentStepsParams, LoopAgentStepsResult } from './types'
import type {
  AgentState,
  GoalRecord,
} from '@savant-code/common/types/session-state'

/**
 * FID-2026-0814-002: Durable Budgeted Goal Mode — continuation driver.
 *
 * Wraps the existing step-loop turn machinery (`loopAgentSteps`) with an outer
 * goal loop: run one normal turn, then at the turn boundary decide whether to
 * allocate the next continuation turn. Stops on:
 *   - goal complete (record cleared by `update_goal` → no active goal)
 *   - goal blocked / paused (model or operator set the status)
 *   - budget over (marks the goal blocked with the budget reason)
 *   - continuation cap reached (ECHO-style circuit breaker; marks blocked)
 *   - run aborted (leaves the goal active — the next run start demotes it)
 *
 * Per-turn accounting: `turnsUsed` increments at each goal-turn boundary and
 * `tokensUsed` folds the `directCreditsUsed` delta (the step-usage accounting)
 * so budget reports are live. ECHO circuit breakers are never disabled:
 * `stepsRemaining` keeps decaying across continuation turns and the existing
 * intra-turn loop is untouched. The continuation prompt is a literal string
 * (no closure capture) so the driver is compatible with serialized flows.
 *
 * `loopFn` is a dependency-injection seam for tests (preferred over module
 * mocking — AGENTS.md); production callers always use the default.
 */
export async function driveGoalTurns(
  params: LoopAgentStepsParams,
  loopFn: typeof loopAgentSteps = loopAgentSteps,
): Promise<LoopAgentStepsResult> {
  const { agentState, logger, signal } = params

  let creditsAtTurnStart = agentState.directCreditsUsed
  // First turn: the operator's original prompt (may carry the <goal-set> or
  // <goal-control> directive parsed by createLoopContext).
  let result = await loopFn(params)
  let continuationTurns = 0
  foldGoalTurnAccounting(agentState, creditsAtTurnStart)

  while (
    agentState.goal?.status === 'active' &&
    continuationTurns < GOAL_MAX_CONTINUATION_TURNS &&
    !signal.aborted
  ) {
    const goal = agentState.goal
    const budget = computeBudgetReport(goal)
    if (budget.overBudget) {
      markGoalBlocked(
        goal,
        `Budget exhausted: ${budget.reason ?? 'limit exceeded'}`,
      )
      logger.warn(
        {
          goalId: goal.goalId,
          reason: budget.reason,
          turnsUsed: goal.turnsUsed,
          tokensUsed: goal.tokensUsed,
          wallClockMs: goal.wallClockMs,
        },
        'Goal marked blocked — budget exhausted',
      )
      break
    }

    const continuationPrompt = buildGoalContinuationPrompt(goal, budget)
    creditsAtTurnStart = agentState.directCreditsUsed
    result = await loopFn({
      ...params,
      prompt: continuationPrompt,
      content: undefined,
      spawnParams: undefined,
    })
    continuationTurns += 1
    foldGoalTurnAccounting(agentState, creditsAtTurnStart)
  }

  // Circuit breaker: a goal still active after the continuation cap is blocked
  // so a runaway goal can never loop forever (the operator can resume it).
  if (
    agentState.goal?.status === 'active' &&
    !signal.aborted &&
    continuationTurns >= GOAL_MAX_CONTINUATION_TURNS
  ) {
    markGoalBlocked(
      agentState.goal,
      `Continuation cap reached after ${continuationTurns} continuation turns`,
    )
    logger.warn(
      {
        goalId: agentState.goal.goalId,
        continuationTurns,
      },
      'Goal marked blocked — continuation cap reached',
    )
  }

  return result
}

/**
 * Fold one completed goal turn into the record: increment the turn counter and
 * accrue the credits delta (the existing step-usage accounting) as tokensUsed.
 * No-ops when the record was cleared mid-turn (goal completed).
 */
function foldGoalTurnAccounting(
  agentState: AgentState,
  creditsAtTurnStart: number,
): void {
  const goal: GoalRecord | undefined = agentState.goal
  if (!goal) return
  goal.turnsUsed += 1
  const delta = Math.max(0, agentState.directCreditsUsed - creditsAtTurnStart)
  if (delta > 0) {
    goal.tokensUsed += delta
  }
}

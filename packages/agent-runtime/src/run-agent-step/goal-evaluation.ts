import type { Logger } from '@savant-code/common/types/contracts/logger'

/**
 * FID-2026-0725-083: Goal evaluation — if a goal condition is set and the
 * agent called task_completed, check whether the goal is satisfied.
 * If satisfied → keep shouldEndTurn = true (end the loop).
 * If not satisfied → set shouldEndTurn = false (continue iterating).
 */
export function evaluateGoalCondition(params: {
  shouldEndTurn: boolean
  goalCondition: string | undefined
  fullResponse: string
  logger: Logger
}): boolean {
  const { shouldEndTurn, goalCondition, fullResponse, logger } = params
  if (!shouldEndTurn || !goalCondition) {
    return shouldEndTurn
  }

  const goalSatisfied = /\bGOAL_SATISFIED\b/.test(fullResponse)
  if (goalSatisfied) {
    logger.info(
      { goalCondition },
      'Goal evaluation: GOAL_SATISFIED — ending loop',
    )
    return true
  }

  // Goal not satisfied or error — continue iterating
  const goalNotSatisfied = /\bGOAL_NOT_SATISFIED\b/.test(fullResponse)
  const goalError = /\bGOAL_ERROR\b/.test(fullResponse)
  const reason = goalNotSatisfied
    ? 'NOT_SATISFIED'
    : goalError
      ? 'ERROR'
      : 'no marker found'
  logger.debug(
    { goalCondition, reason },
    `Goal evaluation: ${reason} — continuing iteration`,
  )
  return false
}

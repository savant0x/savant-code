// FID-2026-0819-005 Loop 272: goal-directive handling, extracted verbatim
// from loop-context.ts. Applies the legacy <goal condition="..."> capture,
// the durable <goal-set> record, and <goal-control> pause/resume/cancel to
// the agent state before the loop starts.
import {
  createGoalRecord,
  parseGoalControlDirective,
  parseGoalSetDirective,
  pauseGoal,
  resumeGoal,
} from './goal-engine'

import type { LoopAgentStepsParams } from './types'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * Apply goal directives from the prompt to the agent state (verbatim from
 * createLoopContext). Guarded by `hasUserMessage` — directives ride in the
 * run prompt, so no prompt means nothing to apply.
 */
export function applyGoalDirectives(
  loopParams: LoopAgentStepsParams,
  initialAgentState: AgentState,
  hasUserMessage: boolean,
): void {
  // FID-2026-0725-083: Parse goal condition from the initial message.
  // The /goal command sends <goal condition="..."> in the message content.
  // We extract it and store it in agentState.goalCondition for evaluation
  // after each task_completed call.
  if (hasUserMessage && loopParams.prompt) {
    const goalMatch = loopParams.prompt.match(/<goal condition="([^"]+)">/)
    if (goalMatch && !initialAgentState.goalCondition) {
      initialAgentState.goalCondition = goalMatch[1]
      loopParams.logger.info(
        { goalCondition: goalMatch[1] },
        'Goal condition detected from message — will evaluate after each task_completed',
      )
    }
  }

  // FID-2026-0814-002: structured durable-goal directives from the /goal slash
  // surface. `<goal-set>` creates the durable record (idempotent — never
  // overwrites an existing record mid-run) and supersedes the legacy
  // `goalCondition`; `<goal-control>` applies pause/resume/cancel to the
  // existing record. Directive text is parsed as DATA — the CLI escapes
  // attribute values, so user text cannot break the parse or leak into
  // instruction context.
  if (hasUserMessage && loopParams.prompt) {
    const goalSet = parseGoalSetDirective(loopParams.prompt)
    if (goalSet && !initialAgentState.goal) {
      initialAgentState.goal = createGoalRecord({
        goalId: goalSet.goalId,
        objective: goalSet.objective,
        completionCriterion: goalSet.completionCriterion,
        budgetTokens: goalSet.budgetTokens,
        budgetTurns: goalSet.budgetTurns,
        budgetTimeMs: goalSet.budgetTimeMs,
      })
      initialAgentState.goalCondition = undefined
      loopParams.logger.info(
        {
          goalId: initialAgentState.goal.goalId,
          budgetLimits: initialAgentState.goal.budgetLimits,
        },
        'Durable goal created from <goal-set> directive',
      )
    }
    const goalControl = parseGoalControlDirective(loopParams.prompt)
    if (goalControl && initialAgentState.goal) {
      if (goalControl.action === 'pause') {
        pauseGoal(initialAgentState.goal, goalControl.reason)
        loopParams.logger.info(
          { goalId: initialAgentState.goal.goalId },
          'Durable goal paused via <goal-control>',
        )
      } else if (goalControl.action === 'resume') {
        resumeGoal(initialAgentState.goal)
        loopParams.logger.info(
          { goalId: initialAgentState.goal.goalId },
          'Durable goal resumed via <goal-control>',
        )
      } else if (goalControl.action === 'cancel') {
        loopParams.logger.info(
          { goalId: initialAgentState.goal.goalId },
          'Durable goal cancelled via <goal-control> — record cleared',
        )
        initialAgentState.goal = undefined
      }
    }
  }
}

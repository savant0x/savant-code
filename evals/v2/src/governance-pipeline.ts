import { gradeGovernanceTask } from './governance'

import type { GovernanceTask, GovernanceTaskResult } from './governance'
import type { TraceDocument } from './runner'

export type GovernanceStage = 'deterministic' | 'trajectory' | 'autorater'

export type GovernancePipelineResult = {
  task_id: string
  passed: boolean
  stages: GovernanceStage[]
  deterministic?: GovernanceTaskResult
  trajectory?: GovernanceTaskResult
  autorater?: GovernanceAutoraterResult
  halted_at?: GovernanceStage
}

export type GovernanceAutoraterResult = {
  passed: boolean
  choice: 'A' | 'B'
  rationale?: string
}

export type GovernanceAutorater = (
  task: GovernanceTask,
  trace: TraceDocument,
) => Promise<GovernanceAutoraterResult>

const DEFAULT_AUTORATER: GovernanceAutorater = async () => ({
  passed: true,
  choice: 'A',
})

export async function gradeGovernancePipeline(
  task: GovernanceTask,
  autorater: GovernanceAutorater = DEFAULT_AUTORATER,
): Promise<GovernancePipelineResult> {
  const result: GovernancePipelineResult = {
    task_id: task.task_id,
    passed: false,
    stages: [],
  }

  result.stages.push('deterministic')
  const deterministic = gradeGovernanceTask(task)
  result.deterministic = deterministic
  if (!deterministic.passed) {
    result.halted_at = 'deterministic'
    return result
  }

  result.stages.push('trajectory')
  const trajectory = gradeGovernanceTask(task)
  result.trajectory = trajectory
  if (!trajectory.passed) {
    result.halted_at = 'trajectory'
    return result
  }

  result.stages.push('autorater')
  const autoraterResult = await autorater(task, task.trace)
  result.autorater = autoraterResult
  result.passed = autoraterResult.passed
  return result
}

export function assertPipelineStageOrder(
  stages: readonly GovernanceStage[],
): void {
  const expected: GovernanceStage[] = [
    'deterministic',
    'trajectory',
    'autorater',
  ]
  for (let index = 0; index < stages.length; index += 1) {
    if (stages[index] !== expected[index]) {
      throw new Error(
        `Governance pipeline stage order violation: expected ${expected[index]} at index ${index}, found ${stages[index]}`,
      )
    }
  }
}

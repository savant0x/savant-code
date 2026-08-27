import { describe, expect, it } from 'bun:test'

import { GOVERNANCE_TASKS } from '../src/governance'
import {
  assertPipelineStageOrder,
  gradeGovernancePipeline,
} from '../src/governance-pipeline'

function taskAt(index: number) {
  const task = GOVERNANCE_TASKS[index]
  if (!task) throw new Error(`missing governance task ${index}`)
  return task
}

describe('governance grading pipeline', () => {
  it('runs deterministic, trajectory, then autorater in order', async () => {
    const calls: string[] = []
    const result = await gradeGovernancePipeline(taskAt(0), async () => {
      calls.push('autorater')
      return { passed: true, choice: 'A' }
    })

    expect(result.passed).toBe(true)
    expect(result.stages).toEqual(['deterministic', 'trajectory', 'autorater'])
    expect(calls).toEqual(['autorater'])
    expect(() => assertPipelineStageOrder(result.stages)).not.toThrow()
  })

  it('halts before autorater when deterministic checks fail', async () => {
    const calls: string[] = []
    const task = {
      ...taskAt(0),
      trace: {
        ...taskAt(0).trace,
        events: [
          {
            type: 'phase_transition',
            from: 'idle',
            to: 'adversarial',
          } as const,
        ],
      },
    }
    const result = await gradeGovernancePipeline(task, async () => {
      calls.push('autorater')
      return { passed: true, choice: 'A' }
    })

    expect(result.passed).toBe(false)
    expect(result.halted_at).toBe('deterministic')
    expect(result.stages).toEqual(['deterministic'])
    expect(calls).toEqual([])
  })

  it('rejects malformed stage order declarations', () => {
    expect(() =>
      assertPipelineStageOrder(['trajectory', 'deterministic']),
    ).toThrow('stage order violation')
  })
})

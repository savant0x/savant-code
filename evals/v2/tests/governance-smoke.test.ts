import { describe, expect, it } from 'bun:test'

import {
  GOVERNANCE_TASKS,
  gradeGovernanceTask,
  runGovernanceSmoke,
} from '../src/governance'

describe('Tier-1 governance smoke', () => {
  it('contains exactly five deterministic governance tasks', () => {
    expect(GOVERNANCE_TASKS).toHaveLength(5)
    expect(new Set(GOVERNANCE_TASKS.map((task) => task.task_id)).size).toBe(5)
  })

  it('passes every scripted governance replay without tokens or network', () => {
    const startedAt = Date.now()
    const results = runGovernanceSmoke()
    expect(results).toHaveLength(5)
    expect(results.every((result) => result.passed)).toBe(true)
    expect(results.flatMap((result) => result.failures)).toEqual([])
    expect(Date.now() - startedAt).toBeLessThan(30_000)
  })

  it('fails loudly when a legal FSM replay is altered', () => {
    const task = GOVERNANCE_TASKS[0]
    if (!task) throw new Error('missing FSM governance task')
    const result = gradeGovernanceTask({
      ...task,
      trace: {
        ...task.trace,
        events: [
          {
            type: 'phase_transition',
            from: 'idle',
            to: 'adversarial',
          },
        ],
      },
    })
    expect(result.passed).toBe(false)
    expect(result.failures).toEqual(['illegal FSM transition observed'])
  })

  it('fails a Law-1 replay with no read event', () => {
    const task = GOVERNANCE_TASKS[1]
    if (!task) throw new Error('missing Law-1 governance task')
    const result = gradeGovernanceTask({
      ...task,
      trace: { ...task.trace, events: [] },
    })
    expect(result.passed).toBe(false)
    expect(result.failures).toContain('required complete read was not observed')
  })
})

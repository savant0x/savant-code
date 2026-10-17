import { expect, test } from 'bun:test'

import { runSchedule } from './scheduler'
import { SliceStore } from './store'

import type { Artifact, Assignment, RunBatch, TaskResult } from './types'

function result(assignment: Assignment): TaskResult {
  const artifact: Artifact = {
    taskId: assignment.id,
    answer: 'Control test only; no model performance claim',
    citations: [
      { path: 'a.ts', line: 1, quote: 'first quotation' },
      { path: 'a.ts', line: 2, quote: 'second quotation' },
    ],
    usedHandoffs: [],
  }
  return {
    assignment,
    artifact,
    startedAt: 0,
    completedAt: 0,
    readPaths: [],
    toolCalls: [],
  }
}
const tasks: Assignment[] = [
  { id: 'A', question: 'A', files: [], dependsOn: [] },
  { id: 'B', question: 'B', files: [], dependsOn: [] },
  { id: 'C', question: 'Use A', files: [], dependsOn: ['A'] },
  { id: 'D', question: 'Use B and C', files: [], dependsOn: ['B', 'C'] },
]

test('completion releases C before B settles; actual handoff is preserved', async () => {
  const store = new SliceStore(':memory:', 'source')
  const slow = Promise.withResolvers<void>()
  const followup = Promise.withResolvers<void>()
  const order: string[] = []
  const runBatch: RunBatch = async (assignments, handoffs) => {
    const assignment = assignments[0]
    if (!assignment) throw new Error('Empty test wave')
    order.push(assignment.id)
    if (assignment.id === 'B') await slow.promise
    if (assignment.id === 'C') {
      expect(handoffs.C?.[0]?.artifact.taskId).toBe('A')
      expect(handoffs.C?.[0]?.digest).toHaveLength(64)
      followup.resolve()
    }
    return assignments.map(result)
  }
  try {
    const running = runSchedule({
      mode: 'completion',
      assignments: tasks,
      store,
      runBatch,
      signal: new AbortController().signal,
    })
    await followup.promise
    expect(order).toEqual(['A', 'B', 'C'])
    expect(store.task('B').state).toBe('running')
    slow.resolve()
    expect(await running).toHaveLength(4)
    expect(order).toEqual(['A', 'B', 'C', 'D'])
  } finally {
    slow.resolve()
    store.close()
  }
})

test('batch preserves sibling barrier and terminal synthesis dependencies', async () => {
  const store = new SliceStore(':memory:', 'source')
  const waves: string[][] = []
  try {
    await runSchedule({
      mode: 'batch',
      assignments: tasks,
      store,
      signal: new AbortController().signal,
      runBatch: async (assignments) => {
        waves.push(assignments.map((task) => task.id))
        return assignments.map(result)
      },
    })
    expect(waves).toEqual([['A', 'B'], ['C'], ['D']])
  } finally {
    store.close()
  }
})

test('cancel while waiting rejects late result and never starts dependent work', async () => {
  const store = new SliceStore(':memory:', 'source')
  const controller = new AbortController()
  const started = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  try {
    const running = runSchedule({
      mode: 'completion',
      assignments: tasks.slice(0, 1),
      store,
      signal: controller.signal,
      runBatch: async (assignments) => {
        started.resolve()
        await release.promise
        return assignments.map(result)
      },
    })
    await started.promise
    controller.abort()
    release.resolve()
    await expect(running).rejects.toThrow('cancel')
    expect(store.task('A').state).toBe('cancelled')
    expect(store.owner().context).toBe('[]')
  } finally {
    release.resolve()
    store.close()
  }
})

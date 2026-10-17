import { expect, test } from 'bun:test'

import {
  comparisonWorkflows,
  FINAL_BRIEF,
  reviewedWorkflows,
} from './workflows'
import { ASSIGNMENTS } from './workload'

test('all variants have the same final brief and source coverage within nine sends', () => {
  const plans = comparisonWorkflows()
  expect(plans.map((plan) => plan.id)).toEqual(['fused', 'flat', 'chain'])
  expect(plans.reduce((sum, plan) => sum + plan.assignments.length, 0)).toBe(9)
  const expected = [
    ...new Set(ASSIGNMENTS.flatMap((task) => task.files)),
  ].sort()
  for (const plan of plans) {
    const final = plan.assignments.find((task) => task.id === 'D')
    expect(final?.question).toBe(FINAL_BRIEF)
    expect(final?.files.toSorted()).toEqual(expected)
    expect(plan.mode).toBe('batch')
  }
})

test('review candidate uses two fresh draft-review replications and keeps host constraints', () => {
  const plans = reviewedWorkflows()
  expect(plans.reduce((sum, plan) => sum + plan.assignments.length, 0)).toBe(4)
  for (const plan of plans) {
    expect(plan.finalTaskId).toBe('R')
    const [draft, review] = plan.assignments
    expect(draft?.dependsOn).toEqual([])
    expect(review?.dependsOn).toEqual(['D'])
    expect(draft?.files).toEqual(review?.files)
    for (const task of plan.assignments) {
      expect(task.question).toContain(
        'all observed incurred or uncertain usage',
      )
      expect(task.question).toContain('all existing mandatory review triggers')
      expect(task.question).toContain('No shared concurrent writers')
    }
  }
})

test('flat removes only the research ordering dependency and joins all findings', () => {
  const flat = comparisonWorkflows().find((plan) => plan.id === 'flat')
  if (!flat) throw new Error('Missing flat plan')
  expect(
    flat.assignments
      .filter((task) => task.dependsOn.length === 0)
      .map((task) => task.id),
  ).toEqual(['C', 'A', 'B'])
  const final = flat.assignments.find((task) => task.id === 'D')
  expect(final?.dependsOn).toEqual(['A', 'B', 'C'])
  const c = flat.assignments.find((task) => task.id === 'C')
  expect(c?.files).toHaveLength(3)
  expect(c?.files.some((file) => file.endsWith('spawn-agents.ts'))).toBe(false)
  expect(
    flat.assignments.every(
      (task) => task.id === 'D' || task.dependsOn.length === 0,
    ),
  ).toBe(true)
})

test('comparison construction never mutates the original graph or another trial', () => {
  const before = JSON.stringify(ASSIGNMENTS)
  const plans = comparisonWorkflows()
  const first = plans[0]?.assignments[0]
  if (!first) throw new Error('Missing fused plan')
  first.files.length = 0
  first.question = 'Changed locally'
  expect(JSON.stringify(ASSIGNMENTS)).toBe(before)
  expect(comparisonWorkflows()[0]?.assignments[0]?.question).toBe(FINAL_BRIEF)
  expect(
    plans[2]?.assignments.find((task) => task.id === 'D')?.files,
  ).toHaveLength(9)
})

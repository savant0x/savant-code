import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import {
  learningRepairOrderIssues,
  validateLearningRepairOrder,
} from '../experiences-learning-order'

import type { CanonicalLearningRule } from '../learnings-rules'
import type { StructuredLearning } from '../learnings-types'

const key = 'v1:read_files:incomplete-arguments:unexpected'
const lesson: StructuredLearning = {
  title: 'Observed class repair',
  date: '2026-10-13',
  failure: 'Failure',
  evidence: [],
  invariant: 'Keep the class fixed',
  guard: 'Observe the shared probe',
  verification: 'Qualified observation',
  scope: 'internal',
  owningFids: ['FID-2026-1012-017'],
  status: 'active',
  canonicalRule: 'class-repair',
}
const rule: CanonicalLearningRule = {
  name: 'class-repair',
  authority: 'fixture',
  validation: 'fixture',
  tier: 'reference',
  tierReason: 'Fixture',
  failureClasses: [key],
}

describe('class repair lesson-last ordering', () => {
  test('silence, recurrence and the wrong owner never qualify an active repair lesson', () => {
    for (const state of [
      'unresolved',
      'incomplete-observation',
      'recurred',
    ] as const)
      expect(
        learningRepairOrderIssues({
          entries: [lesson],
          rules: [rule],
          classes: [{ key, state, owner: 'FID-2026-1012-017' }],
        })[0]?.code,
      ).toBe('learning.repair.unproved')
    expect(
      learningRepairOrderIssues({
        entries: [lesson],
        rules: [rule],
        classes: [{ key, state: 'observed', owner: 'FID-2026-1012-018' }],
      }),
    ).toHaveLength(1)
  })
  test('qualified observed repair and the actual owner qualify; historical and proven expected guidance do not claim repair', () => {
    expect(
      learningRepairOrderIssues({
        entries: [lesson],
        rules: [rule],
        classes: [{ key, state: 'observed', owner: 'FID-2026-1012-017' }],
      }),
    ).toEqual([])
    expect(
      learningRepairOrderIssues({
        entries: [{ ...lesson, status: 'historical' }],
        rules: [rule],
        classes: [],
      }),
    ).toEqual([])
    expect(
      learningRepairOrderIssues({
        entries: [lesson],
        rules: [rule],
        classes: [{ key, state: 'unresolved', expectedness: 'expected' }],
      }),
    ).toEqual([])
    expect(
      learningRepairOrderIssues({
        entries: [lesson],
        rules: [rule],
        classes: [],
      }),
    ).toHaveLength(1)
  })
  test('the disk-backed validator refuses class-linked lessons without observation evidence', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-order-'))
    try {
      fs.mkdirSync(path.join(root, 'dev'))
      fs.writeFileSync(
        path.join(root, 'dev/LEARNING-RULES.md'),
        `## Rule: class-repair\n- **Authority:** fixture\n- **Validation:** fixture\n- **Tier:** reference\n- **Tier reason:** Fixture\n- **Failure classes:** ${key}\n`,
      )
      expect(validateLearningRepairOrder(root, [lesson])[0]?.code).toBe(
        'learning.repair.unavailable',
      )
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

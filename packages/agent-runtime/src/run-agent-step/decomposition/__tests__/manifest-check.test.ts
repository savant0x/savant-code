import { describe, expect, it } from 'bun:test'

import { validatePlanManifest } from '../manifest-check'

import type { DriveManifest } from '@savant-code/common/types/auto-drive'

function manifest(): DriveManifest {
  return {
    planId: 'plan-1',
    goal: 'ship the widget',
    resolutionPolicy: 'terminal block on impasse',
    milestones: [
      {
        id: 'm1',
        title: 'core',
        modules: ['cli/src/a.ts'],
        dependsOn: [],
        acceptance: ['typecheck clean'],
      },
      {
        id: 'm2',
        title: 'ui',
        modules: ['cli/src/b.tsx'],
        dependsOn: ['m1'],
        acceptance: ['renders'],
      },
    ],
  }
}

describe('validatePlanManifest', () => {
  it('passes a fully-covered acyclic manifest in dependency order', () => {
    const result = validatePlanManifest(manifest(), [
      { id: 'FID-1', milestoneId: 'm1', dependsOn: [] },
      { id: 'FID-2', milestoneId: 'm2', dependsOn: ['FID-1'] },
    ])
    expect(result.valid).toBe(true)
    expect(result.orderedMilestones).toEqual(['m1', 'm2'])
  })

  it('fails when a plan milestone has no FID (silent scope drop)', () => {
    const result = validatePlanManifest(manifest(), [
      { id: 'FID-1', milestoneId: 'm1', dependsOn: [] },
    ])
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('m2'))).toBe(true)
  })

  it('fails when a FID maps to an unknown milestone (unapproved scope)', () => {
    const result = validatePlanManifest(manifest(), [
      { id: 'FID-1', milestoneId: 'm1', dependsOn: [] },
      { id: 'FID-2', milestoneId: 'm2', dependsOn: [] },
      { id: 'FID-3', milestoneId: 'ghost', dependsOn: [] },
    ])
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('ghost'))).toBe(true)
  })

  it('fails on duplicate FID ids', () => {
    const result = validatePlanManifest(manifest(), [
      { id: 'FID-1', milestoneId: 'm1', dependsOn: [] },
      { id: 'FID-1', milestoneId: 'm2', dependsOn: [] },
    ])
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('duplicate FID'))).toBe(true)
  })

  it('fails on a dependency cycle', () => {
    const m = manifest()
    m.milestones[0].dependsOn = ['m2']
    const result = validatePlanManifest(m, [
      { id: 'FID-1', milestoneId: 'm1', dependsOn: [] },
      { id: 'FID-2', milestoneId: 'm2', dependsOn: [] },
    ])
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('cycle'))).toBe(true)
  })
})

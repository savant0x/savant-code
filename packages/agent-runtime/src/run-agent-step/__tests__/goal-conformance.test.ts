import { describe, expect, it } from 'bun:test'

import {
  auditCriteria,
  buildCriterionRegistry,
  evaluateCriterion,
  gapToFidDraft,
} from '../goal-conformance'

import type { Criterion } from '@savant-code/common/types/auto-drive'

const evidence = {
  typecheckExitCode: 0,
  testExitCode: 0,
  fileExists: (t: string) => t === 'exists.ts',
  grepMatches: (p: string) => (p === 'found' ? 2 : 0),
}

describe('evaluateCriterion', () => {
  it('passes typecheck and test-suite when exit 0', () => {
    expect(
      evaluateCriterion(
        { id: 'c1', text: 't', strategy: 'typecheck', target: '' },
        evidence,
      ).status,
    ).toBe('pass')
    expect(
      evaluateCriterion(
        { id: 'c2', text: 't', strategy: 'test-suite', target: '' },
        evidence,
      ).status,
    ).toBe('pass')
  })

  it('fails file-existence when the target is missing', () => {
    const result = evaluateCriterion(
      { id: 'c3', text: 't', strategy: 'file-existence', target: 'nope.ts' },
      evidence,
    )
    expect(result.status).toBe('fail')
  })

  it('passes feature-grep when matches exist', () => {
    const result = evaluateCriterion(
      { id: 'c4', text: 't', strategy: 'feature-grep', target: 'found' },
      evidence,
    )
    expect(result.status).toBe('pass')
  })

  it('routes judgment to a gap (Scribe cross-check)', () => {
    const result = evaluateCriterion(
      { id: 'c5', text: 't', strategy: 'judgment', target: '' },
      evidence,
    )
    expect(result.status).toBe('gap')
  })
})

describe('auditCriteria', () => {
  it('collects failed/gap criteria as gaps', () => {
    const criteria: Criterion[] = [
      { id: 'c1', text: 't', strategy: 'typecheck', target: '' },
      { id: 'c2', text: 't', strategy: 'file-existence', target: 'nope.ts' },
    ]
    const { results, gaps } = auditCriteria(criteria, evidence)
    expect(results).toHaveLength(2)
    expect(gaps.map((g) => g.id)).toEqual(['c2'])
  })
})

describe('buildCriterionRegistry', () => {
  it('infers typecheck/test-suite/file-existence/feature-grep strategies', () => {
    const registry = buildCriterionRegistry([
      'all four workspaces typecheck',
      'the sdk test suite passes',
      'create "packages/agent-runtime/src/new.ts"',
      'the drive-lock directive is parsed',
    ])
    expect(registry.map((c) => c.strategy)).toEqual([
      'typecheck',
      'test-suite',
      'file-existence',
      'feature-grep',
    ])
  })
})

describe('gapToFidDraft', () => {
  it('emits a discovery FID draft with the criterion as acceptance target', () => {
    const draft = gapToFidDraft(
      { id: 'c2', text: 't', strategy: 'file-existence', target: 'nope.ts' },
      'FID-2026-0818-001',
    )
    expect(draft.fileName).toContain('c2-gap.md')
    expect(draft.content).toContain('**Status:** created')
    expect(draft.content).toContain('**Master FID:** FID-2026-0818-001')
    expect(draft.content).toContain('(file-existence) t')
  })
})

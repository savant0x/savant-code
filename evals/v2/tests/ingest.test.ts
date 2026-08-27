import { describe, expect, it } from 'bun:test'
import { parse as parseYaml } from 'yaml'

import {
  classifyIssue,
  contentHash,
  ingestIssues,
  withinWindow,
} from '../src/ingest/issues'
import {
  assertTokenCeiling,
  estimateTokens,
  selectForRelease,
} from '../src/ingest/rotation'
import { taskDefinitionSchema } from '../src/schema'

import type { ClosedIssueInput } from '../src/ingest/issues'
import type { RotationCandidate } from '../src/ingest/rotation'

const WINDOW = { start: '2026-01-01', end: '2026-03-31' }

function issue(overrides: Partial<ClosedIssueInput> = {}): ClosedIssueInput {
  return {
    repo: 'acme/widgets',
    number: 7,
    title: 'Fix widget overflow',
    body: 'Overflow occurs on narrow screens.',
    closed_at: '2026-02-15',
    test_command: 'bun test widgets',
    ...overrides,
  }
}

describe('ingestion window + allowlist (FID-2026-0824-019)', () => {
  it('accepts issues closed inside the inclusive window', () => {
    expect(withinWindow('2026-01-01', WINDOW)).toBe(true)
    expect(withinWindow('2026-03-31T10:00:00Z', WINDOW)).toBe(true)
    expect(withinWindow('2025-12-31', WINDOW)).toBe(false)
    expect(withinWindow('2026-04-01', WINDOW)).toBe(false)
  })

  it('skips out-of-window and non-allowlisted repos with reasons', () => {
    const result = ingestIssues(
      [
        issue(),
        issue({ number: 8, closed_at: '2026-05-01' }),
        issue({ repo: 'other/repo', number: 9 }),
      ],
      { window: WINDOW, allowlist: ['acme/widgets'] },
    )
    expect(result.curated).toHaveLength(1)
    expect(result.skipped).toHaveLength(2)
    expect(result.skipped[1]?.reason).toContain('not allowlisted')
  })
})

describe('taxonomy classifier (FID-2026-0824-019)', () => {
  it('maps keyword families to the additive categories', () => {
    const cases: readonly [string, string][] = [
      ['Patch CVE-2026-1234 in auth flow', 'security_remediation'],
      ['Update lockfile after transitive bump', 'dependency_tracing'],
      ['Refactor across monorepo packages', 'cross_repo_navigation'],
      ['Document architecture onboarding flow', 'codebase_comprehension'],
      ['Off-by-one in loop counter', 'pure_coding'],
    ]
    for (const [text, want] of cases) {
      expect(classifyIssue(issue({ title: text, body: '' }))).toBe(want)
    }
  })
})

describe('ingested task round-trip (FID-2026-0824-019)', () => {
  it('emits registry-valid YAML with provenance for curated items', () => {
    const src = issue({ title: 'Patch CVE in sanitizer' })
    const built = ingestIssues([src], { window: WINDOW }).curated[0]
    if (!built) throw new Error('expected a curated task')
    const parsed = parseYaml(built.yaml) as Record<string, unknown>
    const result = taskDefinitionSchema.safeParse(parsed)
    expect(result.success).toBe(true)
    const provenance = parsed['ingest_provenance'] as
      { content_hash?: string } | undefined
    expect(provenance?.content_hash).toBe(contentHash(src))
    expect(parsed['category']).toBe('security_remediation')
  })

  it('leaves check-less drafts intentionally schema-invalid', () => {
    const built = ingestIssues([issue({ test_command: undefined })], {
      window: WINDOW,
    }).drafts[0]
    if (!built) throw new Error('expected a draft')
    const parsed = parseYaml(built.yaml) as Record<string, unknown>
    expect(taskDefinitionSchema.safeParse(parsed).success).toBe(false)
  })
})

describe('rotation registry (FID-2026-0824-019)', () => {
  function candidates(n: number): RotationCandidate[] {
    const cats = ['security_remediation', 'pure_coding']
    return Array.from({ length: n }, (_, i) => ({
      task_id: `task-${String(i).padStart(3, '0')}`,
      category: cats[i % 2] ?? 'pure_coding',
      difficulty: i % 3 === 0 ? 'hard' : 'easy',
    }))
  }

  it('is deterministic per version and rotates across versions', () => {
    const pool = candidates(12)
    const a1 = selectForRelease(pool, '1.0.0').map((t) => t.task_id)
    const a2 = selectForRelease(pool, '1.0.0').map((t) => t.task_id)
    const b = selectForRelease(pool, '2.0.0').map((t) => t.task_id)
    expect(a1).toEqual(a2)
    expect(b).not.toEqual(a1)
  })

  it('caps selection per stratum and sorts canonically', () => {
    const picked = selectForRelease(candidates(12), '3.0.0')
    // two categories × up to two difficulties ⇒ at most four strata × 2.
    expect(picked.length).toBeLessThanOrEqual(8)
    const sorted = [...picked.map((t) => t.task_id)].sort()
    expect(picked.map((t) => t.task_id)).toEqual(sorted)
  })

  it('enforces the token ceiling fail-closed', () => {
    expect(estimateTokens(20)).toBe(2_000_000)
    expect(() => assertTokenCeiling(2_000_001)).toThrow('ceiling')
    expect(() => assertTokenCeiling(2_000_000)).not.toThrow()
    expect(() => assertTokenCeiling(-1)).toThrow('invalid token estimate')
  })
})

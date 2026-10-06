/**
 * FID-2026-1005-005 — Tier 2, trigger/routing evals (declared gate).
 *
 * Pins the deterministic ranking contract: the case-file schema's
 * non-vacuous owner rules, ranking determinism (same input, same order,
 * ties by name), the routing assertions on a fixture corpus (positive
 * ranks within topK, negative stays off rank-1, owner outranks pairwise),
 * the description-only collision corpus, and the live-catalog run against
 * the checked-in floor. Zero model calls throughout.
 */
import path from 'node:path'

import { describe, expect, it } from 'bun:test'

import {
  buildCorpus,
  rankSkills,
  skillCollision,
} from '../src/skill-evals/rank'
import { floorWasLowered, runTriggerEvals } from '../src/skill-evals/run'
import {
  ownersOutsideCatalog,
  skillCaseSchema,
} from '../src/skill-evals/trigger-cases'

import type { SkillMetadataDoc } from '../src/skill-evals/rank'

// bun test runs from the workspace root — anchor the repo explicitly.
const ROOT = path.resolve(import.meta.dir, '..', '..', '..')

const FIXTURES: SkillMetadataDoc[] = [
  {
    name: 'alpha-release',
    description:
      'Release cycle conventions including CHANGELOG format, version bumping, and git workflow.',
  },
  {
    name: 'beta-design',
    description:
      'Audit interfaces and UI polish with evidence-based adversarial review for design work.',
  },
  {
    name: 'gamma-motion',
    description:
      'Build a scroll-driven landing page where the hero video scrubs frame by frame under the wheel.',
  },
]

describe('case-file schema (FID-2026-1005-005)', () => {
  const valid = {
    skillName: 'some-skill',
    trigger: {
      positive: [{ prompt: 'p1' }, { prompt: 'p2' }, { prompt: 'p3' }],
      negative: [{ prompt: 'n1' }, { prompt: 'n2' }],
    },
  }

  it('accepts the minimal case and defaults topK to 3', () => {
    const parsed = skillCaseSchema.parse(valid)
    expect(parsed.trigger.positive[0].topK).toBe(3)
  })

  it('rejects fewer than 3 positives or 2 negatives', () => {
    expect(
      skillCaseSchema.safeParse({
        ...valid,
        trigger: {
          positive: valid.trigger.positive.slice(0, 2),
          negative: valid.trigger.negative,
        },
      }).success,
    ).toBe(false)
    expect(
      skillCaseSchema.safeParse({
        ...valid,
        trigger: {
          positive: valid.trigger.positive,
          negative: valid.trigger.negative.slice(0, 1),
        },
      }).success,
    ).toBe(false)
  })

  it('rejects an owner that equals skillName (self-outrank is vacuous)', () => {
    const parsed = skillCaseSchema.safeParse({
      ...valid,
      trigger: {
        positive: valid.trigger.positive,
        negative: [{ prompt: 'n1', owner: 'some-skill' }, { prompt: 'n2' }],
      },
    })
    expect(parsed.success).toBe(false)
  })

  it('ownersOutsideCatalog names an unknown owner instead of ranking vacuously', () => {
    const parsed = skillCaseSchema.parse({
      ...valid,
      trigger: {
        positive: valid.trigger.positive,
        negative: [{ prompt: 'n1', owner: 'ghost-skill' }, { prompt: 'n2' }],
      },
    })
    const problems = ownersOutsideCatalog(
      parsed,
      new Set(['some-skill', 'other-skill']),
    )
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain("'ghost-skill' is not in the catalog")
  })
})

describe('deterministic ranking (FID-2026-1005-005)', () => {
  const corpus = buildCorpus(FIXTURES)

  it('a prompt with the skill vocabulary ranks it within topK — rank 1 on a signature ask', () => {
    const ranked = rankSkills(
      'bump the version and write the changelog for the release',
      corpus,
    )
    expect(ranked[0].name).toBe('alpha-release')
  })

  it('same input, same ranking (determinism)', () => {
    const a = rankSkills('audit this interface with evidence', corpus)
    const b = rankSkills('audit this interface with evidence', corpus)
    expect(a).toEqual(b)
  })

  it('ties break by skill name so runs are reproducible', () => {
    const tied = buildCorpus([
      { name: 'zzz-identical', description: 'shared vocabulary only' },
      { name: 'aaa-identical', description: 'shared vocabulary only' },
    ])
    const ranked = rankSkills('shared vocabulary only', tied)
    expect(ranked[0].name).toBe('aaa-identical')
    expect(ranked[1].name).toBe('zzz-identical')
  })

  it('a negative prompt keeps the skill off rank-1 (owner outranks pairwise)', () => {
    const ranked = rankSkills(
      'hero video scrubs frame by frame on scroll',
      corpus,
    )
    const design = ranked.find((entry) => entry.name === 'beta-design')
    const motion = ranked.find((entry) => entry.name === 'gamma-motion')
    expect(motion?.rank).toBe(1)
    expect(design?.rank).not.toBe(1)
    expect(motion?.rank).toBeLessThan(design?.rank ?? Number.POSITIVE_INFINITY)
  })

  it('the collision corpus uses description-only vectors (nameWeight 0)', () => {
    // Same description, different names: the metadata vectors would collide
    // on name tokens alone; description-only vectors must score 1.0 exactly,
    // and DISTINCT descriptions must not be inflated by name overlap.
    const same = buildCorpus(
      [
        { name: 'prefix-one', description: 'identical wording here' },
        { name: 'prefix-two', description: 'identical wording here' },
      ],
      { nameWeight: 0 },
    )
    expect(
      skillCollision(
        { name: 'prefix-one', description: 'identical wording here' },
        { name: 'prefix-two', description: 'identical wording here' },
        same,
      ),
    ).toBeCloseTo(1, 6)
    const meta = buildCorpus([
      { name: 'prefix-one', description: 'unique alpha words' },
      { name: 'prefix-two', description: 'completely other terms' },
    ])
    expect(
      skillCollision(
        { name: 'prefix-one', description: 'unique alpha words' },
        { name: 'prefix-two', description: 'completely other terms' },
        meta,
      ),
    ).toBeGreaterThan(0)
    // Description-only vectors on the same distinct pair score exactly 0 —
    // the name overlap cannot inflate the collision signal.
    const descOnlyDistinct = buildCorpus(
      [
        { name: 'prefix-one', description: 'unique alpha words' },
        { name: 'prefix-two', description: 'completely other terms' },
      ],
      { nameWeight: 0 },
    )
    expect(
      skillCollision(
        { name: 'prefix-one', description: 'unique alpha words' },
        { name: 'prefix-two', description: 'completely other terms' },
        descOnlyDistinct,
      ),
    ).toBe(0)
  })
})

describe('rank-1 floor ratchet (FID-2026-1005-005)', () => {
  it('rejects a floor below the committed value and accepts equal or higher floors', () => {
    const committed = { rank1Floor: 0.8, measuredAt: '2026-10-01' }
    expect(floorWasLowered({ rank1Floor: 0.79, measuredAt: '2026-10-02' }, committed)).toBe(true)
    expect(floorWasLowered(committed, committed)).toBe(false)
    expect(floorWasLowered({ rank1Floor: 0.9, measuredAt: '2026-10-02' }, committed)).toBe(false)
  })
})

describe('live catalog run (FID-2026-1005-005)', () => {
  const result = runTriggerEvals(ROOT)

  it('covers the trusted catalog with no error issues', () => {
    const errors = result.issues.filter((issue) => issue.severity === 'error')
    expect(errors).toEqual([])
    expect(result.trustedCount).toBeGreaterThanOrEqual(11)
    expect(result.missingCases).toEqual([])
  })

  it('the rank-1 rate clears the checked-in floor', () => {
    expect(result.floor).toBeDefined()
    expect(result.rank1Rate).toBeGreaterThanOrEqual(
      result.floor?.rank1Floor ?? 1,
    )
  })

  it('no description collision reaches the error threshold', () => {
    for (const collision of result.collisions) {
      expect(collision.score).toBeLessThan(0.75)
    }
  })

  it('quarantined drafts are advisory coverage, never CI errors', () => {
    expect(result.draftCount).toBeGreaterThan(0)
    for (const draft of result.draftCoverage) {
      expect(result.missingCases).not.toContain(draft.name)
    }
  })
})

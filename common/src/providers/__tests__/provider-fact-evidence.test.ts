/**
 * FID-2026-1005-009 — provenance rules for provider facts (declared gate).
 *
 * Pins (converged design Verification):
 * 1. Evidence records: the closed class enum, the named source, and
 *    `console-verified` requiring a date plus the witness who saw it.
 * 2. The changed-fact rule: an added or changed numeric fact WITHOUT an
 *    evidence record fails naming the fact and its old → new values (an
 *    EDITED entry, not just a missing field — the Loop 2 negative fixture);
 *    with evidence or untouched it passes; a missing baseline grandfathers.
 * 3. The live registry validates clean with its real evidence record, and
 *    the baseline integration compares like with like.
 */
import { describe, expect, it } from 'bun:test'

import {
  changedFactsNeedingEvidence,
  validateFactEvidence,
} from '../fact-evidence'
import { PROVIDER_REGISTRY } from '../registry'
import { registryFactRecords, validateProviderRegistry } from '../validate'

import type { FactRecord } from '../fact-evidence'
import type { FactEvidence } from '../types'

const publicPage: FactEvidence = {
  class: 'public-page',
  source: 'https://vendor.example/pricing',
}
const consoleVerified: FactEvidence = {
  class: 'console-verified',
  source: 'GET /v1/models (auth)',
  verified: '2026-10-05',
  witness: 'FID-2026-1005-010 live-probe receipt',
}

describe('evidence shape rules (FID-2026-1005-009)', () => {
  it('accepts well-formed records for every class', () => {
    for (const evidence of [
      publicPage,
      { class: 'api-public', source: 'https://vendor.example/api' },
      consoleVerified,
      { class: 'reported-unverified', source: 'vendor blog' },
    ] as const) {
      expect(validateFactEvidence('test', evidence)).toEqual([])
    }
  })

  it('rejects an out-of-enum class', () => {
    const problems = validateFactEvidence('test', {
      class: 'gut-feeling' as 'public-page',
      source: 'somewhere',
    })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('invalid class')
  })

  it('rejects an unnamed source', () => {
    const problems = validateFactEvidence('test', {
      class: 'public-page',
      source: '  ',
    })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('must name its source')
  })

  it('console-verified requires the date and the witness', () => {
    const missingDate = validateFactEvidence('test', {
      class: 'console-verified',
      source: 'console',
    })
    expect(missingDate).toHaveLength(2)
    expect(missingDate.some((p) => p.includes('date'))).toBe(true)

    const missingWitness = validateFactEvidence('test', {
      class: 'console-verified',
      source: 'console',
      verified: '2026-10-05',
    })
    expect(missingWitness).toHaveLength(1)
    expect(missingWitness[0]).toContain('witness')
  })
})

describe('changed-fact rule (FID-2026-1005-009)', () => {
  const baseline: FactRecord[] = [
    { key: 'a.catalog.model-count', value: 7 },
    { key: 'b.catalog.model-count', value: 17 },
  ]

  it('a missing baseline grandfathers everything', () => {
    const edited: FactRecord[] = [{ key: 'a.catalog.model-count', value: 99 }]
    expect(changedFactsNeedingEvidence(edited, undefined)).toEqual([])
  })

  it('an added fact without evidence is named', () => {
    const issues = changedFactsNeedingEvidence(
      [
        { key: 'a.catalog.model-count', value: 7 },
        { key: 'new.catalog.model-count', value: 3 },
      ],
      baseline,
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]).toContain("'new.catalog.model-count'")
    expect(issues[0]).toContain('new fact')
  })

  it('an EDITED entry without evidence names the old → new values', () => {
    const issues = changedFactsNeedingEvidence(
      [
        { key: 'a.catalog.model-count', value: 9 },
        { key: 'b.catalog.model-count', value: 17 },
      ],
      baseline,
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]).toContain("'a.catalog.model-count'")
    expect(issues[0]).toContain('7 → 9')
  })

  it('a changed fact with well-formed evidence passes', () => {
    const issues = changedFactsNeedingEvidence(
      [{ key: 'a.catalog.model-count', value: 9, evidence: publicPage }],
      baseline,
    )
    expect(issues).toEqual([])
  })

  it('a changed fact with malformed evidence names the shape problem', () => {
    const issues = changedFactsNeedingEvidence(
      [
        {
          key: 'a.catalog.model-count',
          value: 9,
          evidence: { class: 'console-verified', source: 'console' },
        },
      ],
      baseline,
    )
    expect(issues).toHaveLength(2) // missing date + missing witness
  })

  it('untouched facts cost nothing', () => {
    const issues = changedFactsNeedingEvidence(
      [
        { key: 'a.catalog.model-count', value: 7 },
        { key: 'b.catalog.model-count', value: 17 },
      ],
      baseline,
    )
    expect(issues).toEqual([])
  })
})

describe('live registry gate (FID-2026-1005-009)', () => {
  it('validates clean with its real evidence records', () => {
    expect(validateProviderRegistry(PROVIDER_REGISTRY)).toEqual([])
  })

  it('derives one fact per static/inline catalog, carrying evidence', () => {
    const facts = registryFactRecords(PROVIDER_REGISTRY)
    const chatanywhere = facts.find(
      (f) => f.key === 'chatanywhere.catalog.model-count',
    )
    expect(chatanywhere?.value).toBe(27)
    expect(chatanywhere?.evidence?.class).toBe('console-verified')
    // Providers without evidence are grandfathered, not fabricated.
    const hcnsec = facts.find((f) => f.key === 'hcnsec.catalog.model-count')
    expect(hcnsec?.value).toBe(7)
    expect(hcnsec?.evidence).toBeUndefined()
  })

  it('the baseline integration flags a changed entry without evidence', () => {
    // Baseline carries the OLD recorded value (9); the live registry derives
    // 7 — a changed fact with no evidence record on the entry.
    const baseline = registryFactRecords(PROVIDER_REGISTRY).map((fact) =>
      fact.key === 'tokenbom.catalog.model-count'
        ? { ...fact, value: 9 }
        : fact,
    )
    const issues = validateProviderRegistry(PROVIDER_REGISTRY, baseline)
    expect(
      issues.some((p) => p.includes("'tokenbom.catalog.model-count'")),
    ).toBe(true)
    expect(issues.some((p) => p.includes('9 → 7'))).toBe(true)
  })
})

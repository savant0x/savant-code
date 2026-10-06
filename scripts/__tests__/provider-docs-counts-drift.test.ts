/**
 * FID-2026-1005-009 — the docs-count recompute gate (declared gate).
 *
 * Pins (converged design Verification):
 * 1. A hand-edited roster number fails the recompute with the specific
 *    claim named (claimed vs registry-derived); the corrected prose is
 *    clean (the "regenerate → exit 0" leg).
 * 2. The live repo prose passes every claim in the mapping (the 18-site
 *    census at convergence), and the changed-fact check is clean against
 *    the checked-in generated baseline.
 * 3. The changed-fact negative fixture against an EDITED entry names the
 *    old → new values; evidence on the changed entry clears it.
 * 4. The evidence class renders into `docs/providers.md`'s registry table
 *    (reported-unverified would print as such).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'bun:test'

import { changedFactsNeedingEvidence } from '@savant-code/common/providers/fact-evidence'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'
import { registryFactRecords } from '@savant-code/common/providers/validate'

import {
  checkFactDrift,
  checkRosterClaims,
  parseCatalogBaseline,
} from '../provider-docs-counts-drift'
import { renderRegistryTable } from '../provider-tables'

const ROOT = resolve(import.meta.dir, '..', '..')
const readReal = (file: string): string =>
  readFileSync(resolve(ROOT, file), 'utf8')

describe('roster-count recompute (FID-2026-1005-009)', () => {
  it('names the specific claim when prose drifts from the registry', () => {
    // Hand-edited fixture: HCNSec claims 9, the registry derives 7.
    const fixtures: Record<string, string> = {
      'docs/features.md':
        '- **HCNSec** — OpenAI-compatible gateway on an audited static 9-model allowlist (`HCNSEC_API_KEY`)\n',
    }
    const issues = checkRosterClaims((file) => fixtures[file])
    expect(issues).toHaveLength(1)
    expect(issues[0]).toContain('docs/features.md:1')
    expect(issues[0]).toContain('claimed 9, registry derives 7')
  })

  it('corrected prose is clean (the regenerate leg)', () => {
    const fixtures: Record<string, string> = {
      'docs/features.md':
        '- **HCNSec** — OpenAI-compatible gateway on an audited static 7-model allowlist (`HCNSEC_API_KEY`)\n',
    }
    expect(checkRosterClaims((file) => fixtures[file])).toEqual([])
  })

  it('an unattributable claim is named, never silently skipped', () => {
    const fixtures: Record<string, string> = {
      'docs/features.md':
        'Some prose mentions a static 7-model allowlist with no provider label.\n',
    }
    const issues = checkRosterClaims((file) => fixtures[file])
    expect(issues).toHaveLength(1)
    expect(issues[0]).toContain('attributes to no registry provider')
  })

  it('the twin-of-Atria line attributes to the introducing provider', () => {
    const fixtures: Record<string, string> = {
      'docs/features.md':
        '- **Intern InkStone** — hosted gateway on a static 10-model allowlist (`INTERN_API_KEY`; the China-hosted twin of Atria AI)\n',
    }
    expect(checkRosterClaims((file) => fixtures[file])).toEqual([])
  })

  it('the live repo prose passes every claim in the mapping', () => {
    expect(checkRosterClaims(readReal)).toEqual([])
  })
})

describe('changed-fact baseline diff (FID-2026-1005-009)', () => {
  it('parses the generated registry table into fact records', () => {
    const baseline = parseCatalogBaseline(readReal('docs/providers.md'))
    expect(baseline).toBeDefined()
    const chatanywhere = baseline?.find(
      (f) => f.key === 'chatanywhere.catalog.model-count',
    )
    expect(chatanywhere?.value).toBe(27)
  })

  it('the live repo has no unevidenced fact drift', () => {
    expect(checkFactDrift(readReal)).toEqual([])
  })

  it('the edited-entry negative fixture names old → new; evidence clears it', () => {
    const baseline = parseCatalogBaseline(readReal('docs/providers.md'))
    expect(baseline).toBeDefined()
    // An EDITED entry (the Loop 2 question): tokenbom 7 → 9, no evidence.
    const edited: typeof baseline = (baseline ?? []).map((fact) =>
      fact.key === 'tokenbom.catalog.model-count'
        ? { ...fact, value: 9 }
        : fact,
    )
    const issues = changedFactsNeedingEvidence(edited, baseline)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toContain("'tokenbom.catalog.model-count'")
    expect(issues[0]).toContain('7 → 9')

    const cleared = edited.map((fact) =>
      fact.key === 'tokenbom.catalog.model-count'
        ? {
            ...fact,
            evidence: {
              class: 'console-verified' as const,
              source: 'GET /v1/models (auth)',
              verified: '2026-10-05',
              witness: 'FID-2026-1005-010 live-probe receipt',
            },
          }
        : fact,
    )
    expect(changedFactsNeedingEvidence(cleared, baseline)).toEqual([])
  })

  it('a missing generated table grandfathers (bootstrap rule)', () => {
    expect(checkFactDrift(() => undefined)).toEqual([])
    expect(parseCatalogBaseline('no table here')).toBeUndefined()
  })
})

describe('evidence render (FID-2026-1005-009)', () => {
  it('the evidence class renders into the registry table', () => {
    const table = renderRegistryTable()
    expect(table).toContain('evidence: console-verified 2026-10-05')
    // reported-unverified would print as such — never dressed up.
    expect(table).not.toContain('reported-unverified')
  })

  it('the evidenced provider row carries the rendered evidence', () => {
    const table = renderRegistryTable()
    for (const fact of registryFactRecords(PROVIDER_REGISTRY)) {
      if (fact.evidence === undefined) continue
      const id = fact.key.replace('.catalog.model-count', '')
      const provider = Object.values(PROVIDER_REGISTRY).find(
        (entry) => entry.id === id,
      )
      const row = table
        .split('\n')
        .find((line) => line.startsWith(`| ${provider?.label}`))
      expect(row).toBeDefined()
      expect(row).toContain(`\`${id}\``)
      expect(row).toContain(`evidence: ${fact.evidence.class}`)
    }
  })
})

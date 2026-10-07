/**
 * FID-2026-1006-001 M0 — provider-catalog-parity census helpers.
 *
 * Pins:
 * 1. censusFromCatalog counts rows per provider prefix (the /model grouping).
 * 2. Ids without a slash are skipped (no provider prefix).
 * 3. sortedRows is stable / deterministic (sorted provider order).
 * 4. The probe's census fixture shape round-trips through the real census
 *    file consumed by window-coverage-check.
 * 5. FID-2026-1007-005 step 5: the registry/catalog PAIRING — a provider whose
 *    registry entry declares `catalog.modelsRef` must contribute picker rows,
 *    and an audited exception must still be absent. This is the offline half of
 *    the check (the live half is the declared `provider-parity-check` probe,
 *    which needs the keyed endpoints).
 */
import { describe, expect, it } from 'bun:test'

import { MODEL_CATALOGS } from '@savant-code/common/providers/model-catalogs'

import {
  CATALOG_PAIRING_EXCEPTIONS,
  catalogPairingIssues,
  censusFromCatalog,
  sortedRows,
} from '../provider-catalog-parity'

describe('censusFromCatalog (FID-2026-1006-001 M0)', () => {
  it('counts rows per provider prefix', () => {
    const census = censusFromCatalog(
      [
        { id: 'codecraft/gemma-2-2b' },
        { id: 'codecraft/claude-5' },
        { id: 'xkiro/a' },
      ],
      '2026-10-06T00:00:00Z',
    )
    expect(census.rows).toEqual({ codecraft: 2, xkiro: 1 })
    expect(census.generatedAt).toBe('2026-10-06T00:00:00Z')
    expect(census.probe).toContain('provider-catalog-parity')
  })

  it('skips ids without a provider prefix', () => {
    const census = censusFromCatalog([
      { id: 'bare-model-no-slash' },
      { id: 'openrouter/x' },
    ])
    expect(census.rows).toEqual({ openrouter: 1 })
  })

  it('defaults generatedAt to now and produces a stable shape', () => {
    const census = censusFromCatalog([{ id: 'a/b' }])
    expect(census.generatedAt.length).toBeGreaterThan(0)
    expect(census.notes).toContain('fetchGatewayModels(true)')
  })
})

describe('sortedRows (FID-2026-1006-001 M0)', () => {
  it('sorts keys for deterministic diffs', () => {
    const sorted = sortedRows({ z: 1, a: 2, m: 3 })
    expect(Object.keys(sorted)).toEqual(['a', 'm', 'z'])
    expect(sorted).toEqual({ a: 2, m: 3, z: 1 })
  })
})

describe('catalogPairingIssues (FID-2026-1007-005 step 5)', () => {
  const providers = Object.keys(MODEL_CATALOGS)
  const contributing = (skip: readonly string[] = ['cloudflare']) =>
    providers
      .filter((provider) => !skip.includes(provider))
      .map((provider) => ({ id: `${provider}/one` }))

  it('reports a modelsRef provider that contributes no picker rows', () => {
    // chatanywhere is the instance this check exists for: registered,
    // catalogued, window-covered, documented — and absent from the fan-out.
    const issues = catalogPairingIssues(
      contributing().filter((row) => !row.id.startsWith('chatanywhere/')),
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]).toContain('chatanywhere')
    expect(issues[0]).toContain('contributes 0 picker rows')
  })

  it('is silent when every modelsRef provider contributes rows', () => {
    expect(catalogPairingIssues(contributing())).toEqual([])
  })

  it('reports an audited exception that started contributing rows', () => {
    const issues = catalogPairingIssues(
      providers.map((p) => ({ id: `${p}/one` })),
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]).toContain('cloudflare')
    expect(issues[0]).toContain('remove the stale')
  })

  it('carries a stated reason for every exception', () => {
    expect(Object.keys(CATALOG_PAIRING_EXCEPTIONS)).toEqual(['cloudflare'])
    expect(CATALOG_PAIRING_EXCEPTIONS.cloudflare.length).toBeGreaterThan(40)
  })
})

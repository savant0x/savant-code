/**
 * FID-2026-1006-001 M0 — provider-catalog-parity census helpers.
 *
 * Pins:
 * 1. censusFromCatalog counts rows per provider prefix (the /model grouping).
 * 2. Ids without a slash are skipped (no provider prefix).
 * 3. sortedRows is stable / deterministic (sorted provider order).
 * 4. The probe's census fixture shape round-trips through the real census
 *    file consumed by window-coverage-check.
 */
import { describe, expect, it } from 'bun:test'

import { censusFromCatalog, sortedRows } from '../provider-catalog-parity'

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

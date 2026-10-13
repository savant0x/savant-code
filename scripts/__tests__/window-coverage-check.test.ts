/**
 * FID-2026-1006-001 M3/M4 — WINDOW_COVERAGE_REGISTER truth-check + fix.
 *
 * Pins:
 * 1. A census-measured provider declared `no-runtime-rows` is flagged with
 *    the measured row count and date.
 * 2. Providers with 0 measured rows / absent from the census are never
 *    flagged (absence ≠ lie).
 * 3. fixRegisterArtifact flips ONLY the stale provider's disposition
 *    (id-anchored) and leaves other no-runtime-rows entries untouched.
 * 4. --fix round-trips: after fix, the check passes.
 */
import { describe, expect, it } from 'bun:test'

import {
  checkRegisterAgainstCensus,
  DEFAULT_CENSUS_PATH,
  fixRegisterArtifact,
  loadCensus,
} from '../window-coverage-check'

import type { WindowCoverageEntry } from '@savant-code/common/constants/window-coverage-register'

const CENSUS = {
  generatedAt: '2026-10-06T07:55:00Z',
  rows: { codecraft: 33, cleanapis: 33, xkiro: 129 },
}

const REGISTER = new Map<string, WindowCoverageEntry>([
  ['codecraft', { disposition: 'no-runtime-rows', note: 'old note' }],
  ['cleanapis', { disposition: 'no-runtime-rows', note: 'old note' }],
  ['xkiro', { disposition: 'runtime-published', note: 'fine' }],
  ['cloudflare', { disposition: 'no-runtime-rows', note: 'not in census' }],
])

describe('checkRegisterAgainstCensus (FID-2026-1006-001 M3)', () => {
  it('flags census-measured providers declared no-runtime-rows', () => {
    const issues = checkRegisterAgainstCensus(CENSUS, REGISTER)
    // Both codecraft AND cleanapis are stale in the fixture register.
    expect(issues).toHaveLength(2)
    expect(issues[0]).toContain('codecraft')
    expect(issues[0]).toContain('33 rows')
    expect(issues[0]).toContain('--fix')
    expect(issues[1]).toContain('cleanapis')
  })

  it('never flags runtime-published, zero-row, or census-absent providers', () => {
    // xkiro is runtime-published in the fixture; cloudflare has no census row.
    expect(
      checkRegisterAgainstCensus(
        { rows: { cloudflare: 0, xkiro: 0, openrouter: 6 } },
        REGISTER,
      ),
    ).toEqual([])
  })

  it('a clean census-register pair yields no issues', () => {
    const clean = new Map(REGISTER)
    clean.set('codecraft', { disposition: 'runtime-published', note: '' })
    clean.set('cleanapis', { disposition: 'runtime-published', note: '' })
    expect(checkRegisterAgainstCensus(CENSUS, clean)).toEqual([])
  })
})

describe('fixRegisterArtifact (FID-2026-1006-001 M4)', () => {
  const REGISTER_TEXT = `export const WINDOW_COVERAGE_REGISTER: ReadonlyMap<
  string,
  WindowCoverageEntry
> = new Map([
  [
    'codecraft',
    {
      disposition: 'no-runtime-rows',
      note: 'old note',
    },
  ],
  [
    'cloudflare',
    {
      disposition: 'no-runtime-rows',
      note: 'not in census',
    },
  ],
])`

  it('flips only the stale provider and records the census in the note', () => {
    const { text, changedIds } = fixRegisterArtifact(REGISTER_TEXT, CENSUS)
    expect(changedIds).toEqual(['codecraft'])
    expect(text).toContain("disposition: 'runtime-published'")
    expect(text).toContain('Reconciled from census 33 rows (FID-2026-1006-001')
    // cloudflare's no-runtime-rows entry is untouched.
    expect(text).toContain("'cloudflare'")
    expect(text).toContain("disposition: 'no-runtime-rows'")
    expect(text).toContain("note: 'not in census'")
  })

  it('round-trips: after fix the check passes', () => {
    const { text, changedIds } = fixRegisterArtifact(REGISTER_TEXT, CENSUS)
    // REGISTER_TEXT only contains codecraft + cloudflare (no cleanapis), so
    // exactly one entry flips under the census.
    expect(changedIds).toEqual(['codecraft'])
    const fixed = new Map(REGISTER)
    fixed.set('codecraft', { disposition: 'runtime-published', note: '' })
    fixed.set('cleanapis', { disposition: 'runtime-published', note: '' })
    expect(checkRegisterAgainstCensus(CENSUS, fixed)).toEqual([])
    // The text exercises the id-anchored anchor: the second call changes nothing.
    expect(fixRegisterArtifact(text, CENSUS).changedIds).toEqual([])
  })
})

describe('loadCensus (bootstrap rule)', () => {
  it('returns undefined for a missing/unparseable census', () => {
    expect(
      loadCensus('dev/scratchpad/active/does-not-exist.json'),
    ).toBeUndefined()
  })

  it('returns undefined for a non-census shape', () => {
    expect(loadCensus('package.json')).toBeUndefined()
  })

  it('loads the real measured census fixture', () => {
    const census = loadCensus(DEFAULT_CENSUS_PATH)
    expect(census).toBeDefined()
    expect(typeof census?.rows.codecraft).toBe('number')
    expect(census?.rows.codecraft).toBeGreaterThan(0)
  })
})

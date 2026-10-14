import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { describe, expect, test } from 'bun:test'

import {
  collectChangelogCoverageIssues,
  collectStaleBaselineEntries,
  collectUncoveredFids,
  readCoverageBaseline,
} from '../changelog-coverage.js'
import {
  collectAbbreviatedReferences,
  collectCoveredFids,
  parseEnumerationTail,
  parseShortForm,
} from '../changelog-notation.js'

/** FID-2026-1013-006: live checks resolve the repo root from this file, never the
 * cwd — script gates run with `scripts/` as cwd (FID-2026-1013-001), where a
 * `process.cwd()` root read `scripts/CHANGELOG.md` and threw ENOENT. */
const repoRoot = resolve(import.meta.dir, '..', '..')

/** A short form carries no date, so it resolves against the full ids in its own
 * `##` section. Section scoping is the safety property: without it `FID-013`
 * could borrow a neighbouring section's month and credit the wrong record. */
describe('parseShortForm', () => {
  test('reads a short-form range', () => {
    expect(parseShortForm('FIDs 003–010')).toEqual([{ start: 3, end: 10 }])
  })

  test('reads a short-form range with a hyphen', () => {
    expect(parseShortForm('FIDs 003-010')).toEqual([{ start: 3, end: 10 }])
  })

  test('reads a bare short-form id', () => {
    expect(parseShortForm('FID-013 (Tier 0 — gate restoration)')).toEqual([
      { start: 13, end: 13 },
    ])
  })

  test('a full id is never read as a short form', () => {
    expect(parseShortForm('FID-2026-0918-001')).toEqual([])
  })
})

describe('short forms resolve against their own section only', () => {
  test('a short-form range covers the span under the section date', () => {
    const covered = collectCoveredFids(
      '## v0.0.23 — 2026-08-09\n\n' +
        '> **Optimization and automation program (FIDs 003–010):** completed.\n',
    )
    expect(covered.has('FID-2026-0809-003')).toBe(true)
    expect(covered.has('FID-2026-0809-010')).toBe(true)
    expect(covered.has('FID-2026-0809-005')).toBe(true)
  })

  test('a bare short-form id resolves under its section date', () => {
    const covered = collectCoveredFids(
      '## All-tier program — 2026-08-09\n\n' +
        '> **FID-013 (Tier 0 — gate restoration):** `bun run lint:md` restored.\n',
    )
    expect(covered.has('FID-2026-0809-013')).toBe(true)
  })

  test('a lowercase slug still establishes the section date', () => {
    // The v0.0.23 section carries its whole 2026-0809 wave only inside this
    // Nova inbox path; a case-sensitive prefix scan resolves nothing.
    const covered = collectCoveredFids(
      '## v0.0.23 — 2026-08-09\n\n' +
        'audit at `dev/nova/inbox/2026-08-09-fid-2026-0809-003-010-response.md`.\n' +
        '> **Optimization and automation program (FIDs 003–010):** completed.\n',
    )
    expect(covered.has('FID-2026-0809-007')).toBe(true)
  })

  test('a short form in a section with no date anchor resolves nothing', () => {
    const covered = collectCoveredFids(
      '## Some feature\n\n> Program (FIDs 003–010): shipped.\n',
    )
    expect(covered.has('FID-2026-0809-005')).toBe(false)
    expect(covered.size).toBe(0)
  })

  test('a short form does not reach into a neighbouring section', () => {
    const covered = collectCoveredFids(
      '## Section A — 2026-08-09\n\nFID-2026-0809-001 only.\n' +
        '## Section B — 2026-09-22\n\n> Program (FIDs 500–510): shipped.\n',
    )
    // 500–510 belongs to Section B, whose only full id is 2026-0809-001
    // carried in Section A — so it must NOT resolve to a 2026-0809 id.
    expect(covered.has('FID-2026-0809-505')).toBe(false)
  })
})

/** The gate is only useful if it does not false-positive, so every notation the
 * changelog actually uses gets a leg, and the two shapes that LOOK like an
 * enumeration but are not get negative legs. */
describe('parseEnumerationTail', () => {
  test('reads a dotted range end', () => {
    expect(parseEnumerationTail('..009 — remaining six children')).toEqual([9])
  })

  test('reads an en-dash range end', () => {
    expect(parseEnumerationTail('–029 — LEARNINGS remediation')).toEqual([29])
  })

  test('reads a "through" range end', () => {
    expect(parseEnumerationTail(' through 018 — All-tier program')).toEqual([
      18,
    ])
  })

  test('reads a dashed range end', () => {
    expect(parseEnumerationTail('..-012 — TUI Rebuild')).toEqual([12])
  })

  test('reads a slash sibling', () => {
    expect(parseEnumerationTail('/009 — companion release')).toEqual([9])
  })

  test('reads a sibling-suffix compound', () => {
    expect(parseEnumerationTail('/-004/-005/-007 (closed 2026-09-05)')).toEqual(
      [4, 5, 7],
    )
  })

  test('reads a plus-separated compound range', () => {
    expect(parseEnumerationTail(' + -023..-027: compaction rebuild')).toEqual([
      23, 27,
    ])
  })

  test('a closing paren opens no enumeration', () => {
    expect(
      parseEnumerationTail(') — **Closed + archived 2026-09-18**'),
    ).toEqual([])
  })

  test('a date after a separator is not a sequence number', () => {
    expect(parseEnumerationTail(' + archived 2026-09-18**')).toEqual([])
  })

  test('prose after the id yields nothing', () => {
    expect(
      parseEnumerationTail(' 13-commit release rewrite — gate battery'),
    ).toEqual([])
  })
})

describe('collectCoveredFids', () => {
  test('a range heading covers the inclusive span', () => {
    const covered = collectCoveredFids(
      '## FID-2026-0815-004..009 — harness speed remediation\n',
    )
    expect([...covered].sort()).toEqual([
      'FID-2026-0815-004',
      'FID-2026-0815-005',
      'FID-2026-0815-006',
      'FID-2026-0815-007',
      'FID-2026-0815-008',
      'FID-2026-0815-009',
    ])
  })

  test('a compound covers the named siblings and the span between them', () => {
    const covered = collectCoveredFids(
      '- **FID-2026-0905-001/-004/-005/-007 (closed 2026-09-05)** — campaign\n',
    )
    expect(covered.has('FID-2026-0905-004')).toBe(true)
    expect(covered.has('FID-2026-0905-007')).toBe(true)
    expect(covered.has('FID-2026-0905-006')).toBe(true)
    expect(covered.has('FID-2026-0905-008')).toBe(false)
  })

  test('a close-paren id does NOT cover a same-month sibling', () => {
    const covered = collectCoveredFids(
      '### Free-compute probes run through a bounded pool (FID-2026-0918-001)\n',
    )
    expect(covered.has('FID-2026-0918-001')).toBe(true)
    expect(covered.has('FID-2026-0918-018')).toBe(false)
  })

  test('a status suffix does NOT cover the date in it', () => {
    const covered = collectCoveredFids(
      '### Something shipped (FID-2026-0915-006) — **Closed + archived 2026-09-18**\n',
    )
    expect(covered.has('FID-2026-0915-006')).toBe(true)
    expect(covered.has('FID-2026-0915-018')).toBe(false)
  })

  test('different months are never conflated', () => {
    const covered = collectCoveredFids(
      '## FID-2026-0813-001–010 — Zero-Trust\n',
    )
    expect(covered.has('FID-2026-0813-010')).toBe(true)
    expect(covered.has('FID-2026-0913-010')).toBe(false)
  })
})

/**
 * FID-2026-0927-002 step 3a — the advisory. Tolerance is not attribution: a
 * short form must stay VISIBLE even though it counts as coverage, or the
 * mis-attribution class re-enters unnoticed.
 */
describe('collectAbbreviatedReferences', () => {
  test('surfaces a short-form range and names its section', () => {
    const found = collectAbbreviatedReferences(
      '## v0.0.23 — 2026-08-09\n\n> Program (FIDs 003–010): done.\n',
    )
    expect(found).toHaveLength(1)
    expect(found[0]?.text).toBe('FIDs 003–010')
    expect(found[0]?.section).toBe('v0.0.23 — 2026-08-09')
  })

  test('surfaces a bare short-form id', () => {
    const found = collectAbbreviatedReferences(
      '## All-tier — 2026-08-09\n\n> - **FID-013 (Tier 0):** restored.\n',
    )
    expect(found.map((f) => f.text)).toContain('FID-013')
  })

  test('a changelog of only full ids surfaces nothing', () => {
    const found = collectAbbreviatedReferences(
      '## v0.0.32 — 2026-09-18\n\n### Thing (FID-2026-0917-006)\n',
    )
    expect(found).toEqual([])
  })
})

/** Step 3b — a recorded gap the changelog now covers must not over-credit. */
describe('collectStaleBaselineEntries', () => {
  test('reports a baseline entry the changelog already covers', () => {
    const root = mkdtempSync(join(tmpdir(), 'coverage-stale-'))
    try {
      mkdirSync(join(root, 'dev', 'fids', 'archive'), { recursive: true })
      writeFileSync(
        join(root, 'CHANGELOG.md'),
        '## v0.0.33\n\n### Done (FID-2026-0809-003)\n',
      )
      writeFileSync(
        join(root, 'dev', 'fids', 'archive', 'FID-2026-0809-003-a.md'),
        '# archived\n',
      )
      writeFileSync(
        join(root, 'dev', 'fids', 'archive', 'FID-2026-0809-009-b.md'),
        '# archived\n',
      )
      // 003 is claimed in the changelog; 009 is not. Listing both as known gaps
      // means 003 has gone stale.
      writeFileSync(
        join(root, 'dev', 'changelog-coverage-baseline.json'),
        JSON.stringify({
          knownGaps: ['FID-2026-0809-003', 'FID-2026-0809-009'],
        }),
      )
      expect(collectStaleBaselineEntries(root)).toEqual(['FID-2026-0809-003'])
      // The genuinely-uncovered one is NOT stale, and stays a real gap.
      expect(collectUncoveredFids(root).map((r) => r.id)).toEqual([
        'FID-2026-0809-009',
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('an empty baseline is never stale', () => {
    const root = mkdtempSync(join(tmpdir(), 'coverage-empty-'))
    try {
      mkdirSync(join(root, 'dev', 'fids', 'archive'), { recursive: true })
      writeFileSync(join(root, 'CHANGELOG.md'), '## v0.0.33\n')
      writeFileSync(
        join(root, 'dev', 'changelog-coverage-baseline.json'),
        JSON.stringify({ knownGaps: [] }),
      )
      expect(collectStaleBaselineEntries(root)).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('live repository', () => {
  // The ratchet property, not a magic count: whatever the real changelog leaves
  // uncovered must already be recorded as known debt. This holds whether the
  // baseline is empty or not, and it is what fails if a new gap appears.
  test('every uncovered id is already recorded in the coverage baseline', () => {
    const baseline = readCoverageBaseline(repoRoot)
    for (const record of collectUncoveredFids(repoRoot)) {
      expect(baseline.has(record.id)).toBe(true)
    }
  })

  test('the real repository reports no un-baselined gap', () => {
    expect(collectChangelogCoverageIssues(repoRoot)).toEqual([])
  })
})

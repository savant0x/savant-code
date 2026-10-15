/**
 * tree-drain manifest coverage pins (FID-2026-1007-011).
 *
 * The drain manifest binds paths that move (`dev/build-orders/**`), and the
 * fail-closed runner aborts on gaps/overlaps/empty groups — but no test pinned
 * the coverage invariant. RED: `ls scripts/__tests__ | grep -i drain` was
 * empty; this is the first suite. All pins run the real `GROUPS` through the
 * production loader path (`../tree-drain-manifest.js`, the same module the
 * runner imports) with synthetic changed paths, so no git state is needed.
 */
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'bun:test'

import { GROUPS, type DrainGroup } from '../tree-drain-manifest.js'

/**
 * Verbatim production predicate (`scripts/tree-drain.ts:51-53`). Kept local
 * (not imported) because the runner does not export it; any drift between
 * this copy and the runner is itself a finding.
 */
function matchGroups(groups: DrainGroup[], changePath: string): DrainGroup[] {
  return groups.filter((g) =>
    g.paths.some((p) => changePath === p || changePath.startsWith(`${p}/`)),
  )
}

/** Fail-closed assertion: exactly one group owns the path. */
function expectSingleOwner(changePath: string): void {
  expect(matchGroups(GROUPS, changePath)).toHaveLength(1)
}

describe('tree-drain manifest coverage', () => {
  it('covers every path under the moving dev/build-orders directory', () => {
    expectSingleOwner(
      'dev/build-orders/BO-2026-08-24-model-compliance-telemetry.md',
    )
    expectSingleOwner('dev/build-orders/README.md')
  })

  it('covers a synthetic moved path (the regression this FID exists for)', () => {
    expectSingleOwner('dev/build-orders/archive/2026-10-08-probe.md')
  })

  it('holds no group pairing dev/build-orders with a path beneath it', () => {
    for (const group of GROUPS) {
      if (!group.paths.includes('dev/build-orders')) continue
      const nested = group.paths.filter(
        (q) => q !== 'dev/build-orders' && q.startsWith('dev/build-orders/'),
      )
      expect(nested).toEqual([])
    }
  })

  it('resolves sampled exact entries to exactly one group (no double-claim)', () => {
    expectSingleOwner('scripts/tree-drain.ts')
    expectSingleOwner('CHANGELOG.md')
    expectSingleOwner('cli/src/headless-ndjson.ts')
    expectSingleOwner('dev/agenda.md')
  })

  it('keeps every directory-scoped entry live (reverse pin)', () => {
    const root = fileURLToPath(new URL('../../', import.meta.url))
    const dirEntries = [...new Set(GROUPS.flatMap((g) => g.paths))].filter(
      (p) => {
        const full = path.join(root, p)
        return existsSync(full) && statSync(full).isDirectory()
      },
    )
    // Non-vacuous: the governed entry must be among the live directories.
    expect(dirEntries.length).toBeGreaterThan(0)
    expect(dirEntries).toContain('dev/build-orders')
    for (const dir of dirEntries) {
      expectSingleOwner(`${dir}/__coverage_pin__.md`)
    }
  })

  it('detects the -010 overlap class on a fixture manifest (pins are load-bearing)', () => {
    const fixture: DrainGroup[] = [
      { message: 'a', paths: ['dev/build-orders'] },
      {
        message: 'b',
        paths: ['dev/build-orders/BO-2026-08-23-git-workflow-enforcement.md'],
      },
    ]
    expect(
      matchGroups(
        fixture,
        'dev/build-orders/BO-2026-08-23-git-workflow-enforcement.md',
      ),
    ).toHaveLength(2)
  })

  it('detects a narrowed manifest on a fixture (moved path uncovered)', () => {
    const narrowed: DrainGroup[] = [
      {
        message: 'a',
        paths: ['dev/build-orders/BO-2026-08-23-git-workflow-enforcement.md'],
      },
    ]
    expect(
      matchGroups(narrowed, 'dev/build-orders/archive/2026-10-08-probe.md'),
    ).toHaveLength(0)
  })
})

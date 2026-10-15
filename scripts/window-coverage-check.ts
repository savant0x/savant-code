/**
 * WINDOW_COVERAGE_REGISTER truth-check + reconciliation (FID-2026-1006-001
 * M3/M4).
 *
 * The register is hand-maintained truth whose shape gate can never see a lie:
 * a provider declared `no-runtime-rows` can sit beside live rows forever.
 * This script is the mechanical drift detector (the `provider-docs-counts`
 * probe route — importable pure checks + guarded main, exit 0 clean / 1
 * naming the issues):
 *
 *   - checkRegisterAgainstCensus(census, register)  -> string[] issues
 *     Every provider the census measured with > 0 rows must NOT be declared
 *     `no-runtime-rows` in the register.
 *   - fixRegisterArtifact(text, census) -> { text, changedIds }
 *     Anchored textual rewrite: flips the stale disposition to
 *     `runtime-published` (per-provider id-anchored, so only the stale
 *     entry moves) and records the measured census in the note. Atomic
 *     tmp+rename write when the caller persists.
 *
 * `--fix` applies the rewrite to the real register file and re-runs the
 * check. The CLI (gateway.ts) only WARNS about drift — this script is the
 * safe reconciliation surface (M4).
 */
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { WINDOW_COVERAGE_REGISTER } from '@savant-code/common/constants/window-coverage-register'

import type { WindowCoverageEntry } from '@savant-code/common/constants/window-coverage-register'

const ROOT = resolve(import.meta.dir, '..')

export const REGISTER_PATH = 'common/src/constants/window-coverage-register.ts'
export const DEFAULT_CENSUS_PATH =
  'common/src/constants/provider-catalog-census.json'

export type CatalogCensus = {
  generatedAt?: string
  probe?: string
  rows: Record<string, number>
}

/** Load a census JSON (undefined when absent/unparseable — the bootstrap rule). */
export function loadCensus(path: string): CatalogCensus | undefined {
  try {
    const parsed = JSON.parse(
      readFileSync(resolve(ROOT, path), 'utf8'),
    ) as CatalogCensus
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.rows !== 'object'
    ) {
      return undefined
    }
    return parsed
  } catch {
    return undefined
  }
}

/**
 * Census-measured providers still declared `no-runtime-rows` in the register
 * (the stale set). The register is injectable for tests. Providers with 0
 * measured rows, or no census row, are never flagged (absence ≠ lie).
 */
export function staleCensusIds(
  census: CatalogCensus,
  register: ReadonlyMap<string, WindowCoverageEntry> = WINDOW_COVERAGE_REGISTER,
): string[] {
  const stale: string[] = []
  for (const [id, rows] of Object.entries(census.rows)) {
    if (typeof rows !== 'number' || rows <= 0) continue
    if (register.get(id)?.disposition === 'no-runtime-rows') stale.push(id)
  }
  return stale
}

/**
 * Check: every census-measured provider with rows must not be declared
 * `no-runtime-rows`. The register is injectable for tests.
 */
export function checkRegisterAgainstCensus(
  census: CatalogCensus,
  register: ReadonlyMap<string, WindowCoverageEntry> = WINDOW_COVERAGE_REGISTER,
): string[] {
  return staleCensusIds(census, register).map(
    (id) =>
      `${id} declared 'no-runtime-rows' but the census measured ${census.rows[id]} rows ` +
      `(${census.generatedAt ?? 'date unknown'}) — run window-coverage:check --fix`,
  )
}

/** The register entry block for one provider id (prettier-shaped). */
function entryBlock(id: string): string {
  return `    '${id}',\n    {\n      disposition: 'no-runtime-rows',`
}

/** Escape a provider id for literal use inside a RegExp. */
function escapeRegExp(id: string): string {
  return id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Anchored rewrite: for each census-measured stale provider, replace its
 * ENTIRE entry block (id line through the entry's closing `    },`) with a
 * `runtime-published` entry carrying the census-recorded note. Replacing the
 * whole block (not just the disposition line) guarantees the old `note:` can
 * never survive beside the new one — the duplicate-key defect from the first
 * implementation. Other no-runtime-rows entries are untouched. Pure over the
 * register text; the caller persists.
 */
export function fixRegisterArtifact(
  text: string,
  census: CatalogCensus,
): { text: string; changedIds: string[] } {
  let out = text
  const changedIds: string[] = []
  for (const [id, rows] of Object.entries(census.rows)) {
    if (typeof rows !== 'number' || rows <= 0) continue
    const anchor = entryBlock(id)
    if (!out.includes(anchor)) continue
    const date = (census.generatedAt ?? '').slice(0, 10) || 'unknown-date'
    const block = new RegExp(
      `    '${escapeRegExp(id)}',\\n    \\{\\n      disposition: 'no-runtime-rows',\\n[\\s\\S]*?\\n    \\},`,
    )
    const replacement =
      `    '${id}',\n    {\n      disposition: 'runtime-published',\n` +
      `      note: 'Reconciled from census ${rows} rows (FID-2026-1006-001, ${date}).',\n    },`
    out = out.replace(block, replacement)
    changedIds.push(id)
  }
  return { text: out, changedIds }
}

function main(): void {
  const fix = process.argv.includes('--fix')
  const census = loadCensus(DEFAULT_CENSUS_PATH)
  if (census === undefined) {
    console.error(
      `Census not found at ${DEFAULT_CENSUS_PATH} — nothing to check.`,
    )
    process.exit(1)
  }

  if (!fix) {
    const issues = checkRegisterAgainstCensus(census)
    if (issues.length > 0) {
      for (const issue of issues) console.error(`ISSUE: ${issue}`)
      console.error(
        `WINDOW_COVERAGE_REGISTER drifted from the census (${issues.length} issue(s)); run window-coverage:check --fix to reconcile.`,
      )
      process.exit(1)
    }
    console.log(
      'WINDOW_COVERAGE_REGISTER matches the census; no stale no-runtime-rows entries.',
    )
    process.exit(0)
  }

  // --fix: apply the anchored rewrite, persist atomically, then verify the
  // WRITTEN TEXT. The in-process module import predates the write by design,
  // so the re-check must read the file back (a stale import would re-report
  // the pre-fix state — the second defect from the first implementation). A
  // fresh-process `window-coverage:check` remains the final confirmatory gate.
  const path = resolve(ROOT, REGISTER_PATH)
  const before = readFileSync(path, 'utf8')
  const { text, changedIds } = fixRegisterArtifact(before, census)
  // Verifier FAIL 2 (FID-2026-1006-001 audit): a census-stale provider whose
  // anchored entry fails to match the source (format drift / CRLF / prettier
  // version) would otherwise exit 0 "No stale entries" while the register is
  // still stale — a silent exit-0 lie. Fail loud instead, naming the ids.
  const remaining = staleCensusIds(census).filter(
    (id) => !changedIds.includes(id),
  )
  if (remaining.length > 0) {
    for (const id of remaining) {
      console.error(
        `ISSUE: ${id} is stale in the register but its entry could not be ` +
          'matched in the source — check register formatting (CRLF/prettier)',
      )
    }
    console.error(
      `Reconciliation incomplete (${remaining.length} anchor-mismatch issue(s)).`,
    )
    process.exit(1)
  }
  if (changedIds.length === 0) {
    console.log('No stale entries to fix; register already matches the census.')
    process.exit(0)
  }
  const tmp = `${path}.tmp`
  writeFileSync(tmp, text, 'utf8')
  renameSync(tmp, path)

  const written = readFileSync(path, 'utf8')
  const residual = changedIds.filter((id) => written.includes(entryBlock(id)))
  if (residual.length > 0) {
    for (const id of residual) {
      console.error(`ISSUE: ${id} still declared no-runtime-rows after fix`)
    }
    console.error(`Reconciliation incomplete (${residual.length} issue(s)).`)
    process.exit(1)
  }
  console.log(
    `Reconciled WINDOW_COVERAGE_REGISTER: ${changedIds.join(', ')} → runtime-published. ` +
      'Confirm with a fresh `bun run window-coverage:check` (exit 0).',
  )
  process.exit(0)
}

// Guarded so the checks stay importable by the declared gate suite.
if (import.meta.main) main()

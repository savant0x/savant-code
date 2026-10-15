/**
 * CHANGELOG coverage gate.
 *
 * An archived FID whose work is implemented and archived but never named in
 * `CHANGELOG.md` is invisible to anyone reading release notes — the exact
 * defect the T82 / T84 / T86 / T87 sweep found and closed by hand.
 *
 * The gate fails on any archived FID id that the changelog does not claim. Which
 * notations count as a claim is decided by `changelog-notation.ts` (the parser),
 * kept separate so this file is the gate and that one is the grammar.
 *
 * Two refinements from FID-2026-0927-002:
 *   step 3a — short-form references are surfaced (`collectAbbreviatedReferences`),
 *              because tolerating them is not the same as attributing them.
 *   step 3b — a baseline entry that the changelog now covers is a STALE entry and
 *              fails. Without that, a ratchet can over-credit itself silently:
 *              5 of 14 entries were already covered when this was added.
 *
 * Baseline ratchet: `dev/changelog-coverage-baseline.json` records the gaps that
 * predate the gate. Only NEW gaps fail, so introducing this gate does not red
 * the repository on historical debt — the same shape as
 * `dev/quality-baseline.json`. Shrink the baseline as notes are written; the
 * staleness check fails if you forget.
 */
import fs from 'node:fs'
import path from 'node:path'

import {
  collectAbbreviatedReferences,
  collectCoveredFids,
} from './changelog-notation.js'

export type ChangelogCoverageIssue = { code: string; message: string }

export type UncoveredFid = {
  id: string
  file: string
  where: 'active' | 'archive'
}

const FID_FILE = /^FID-\d{4}-\d{4}-\d{3}[^.]*\.md$/
const FID_ID = /FID-\d{4}-\d{4}-\d{3}/
const BASELINE_PATH = 'dev/changelog-coverage-baseline.json'

function listFidRecords(
  dir: string,
  where: 'active' | 'archive',
): UncoveredFid[] {
  let names: string[] = []
  try {
    names = fs.readdirSync(dir)
  } catch {
    return []
  }
  return names
    .filter((name) => FID_FILE.test(name))
    .map((file) => ({
      id: file.match(FID_ID)?.[0] ?? file,
      file,
      where,
    }))
}

/**
 * ARCHIVED FID records the changelog never claims, in filename order.
 *
 * Active records are deliberately EXCLUDED. A `created`/`analyzed`/`converged`
 * record has shipped nothing, so demanding a release note for it is a false
 * finding — and reporting it as living in `dev/fids/archive/` is a false
 * statement about where the file actually is. Both errors were observed on this
 * gate's own first live use: it named a freshly authored active record as
 * archived and failed the repository over it. A record earns a release note by
 * being ARCHIVED, so that is the only point at which one is required.
 */
export function collectUncoveredFids(root: string): UncoveredFid[] {
  const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')
  const covered = collectCoveredFids(changelog)
  return listFidRecords(
    path.join(root, 'dev', 'fids', 'archive'),
    'archive',
  ).filter((record) => !covered.has(record.id))
}

/**
 * Gaps recorded before the gate existed. An entry is an exact FID id; anything
 * not listed here is a new gap and fails.
 */
export function readCoverageBaseline(root: string): Set<string> {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(path.join(root, BASELINE_PATH), 'utf8'),
    ) as { knownGaps?: unknown }
    return new Set(
      Array.isArray(parsed.knownGaps)
        ? parsed.knownGaps.filter((id): id is string => typeof id === 'string')
        : [],
    )
  } catch {
    return new Set()
  }
}

/** Uncovered ids that the baseline does not already record. */
export function collectNewGaps(root: string): UncoveredFid[] {
  const baseline = readCoverageBaseline(root)
  return collectUncoveredFids(root).filter((record) => !baseline.has(record.id))
}

/**
 * FID-2026-0927-002 step 3b — baseline staleness.
 *
 * The ratchet only tightens if a recorded gap that has since been covered is
 * removed from the baseline. Without this check a stale entry is invisible: the
 * gate reports it as known debt forever, and the count in the file drifts from
 * reality. That is the exact condition found while building this gate — 5 of 14
 * entries were already covered. A ratchet that cannot be seen to have moved is
 * not a ratchet.
 */
export function collectStaleBaselineEntries(root: string): string[] {
  const baseline = readCoverageBaseline(root)
  if (baseline.size === 0) return []
  const actual = new Set(collectUncoveredFids(root).map((record) => record.id))
  return [...baseline].filter((id) => !actual.has(id)).sort()
}

/**
 * Baseline-ratcheted, so introducing this gate does not red the repository on
 * historical debt. Only a gap the baseline does not record is an issue; the
 * count of already-recorded gaps lives in the baseline file itself rather than
 * in the issue stream, because every entry `validate:repository` returns is a
 * failure.
 */
export function collectChangelogCoverageIssues(
  root: string,
): ChangelogCoverageIssue[] {
  const gaps: ChangelogCoverageIssue[] = collectNewGaps(root).map((record) => ({
    code: 'changelog.coverage',
    message:
      `${record.id} (dev/fids/${record.where}/${record.file}) is archived but ` +
      'its id appears nowhere in CHANGELOG.md. Every archived record needs a ' +
      'release note; add one, or add the id to ' +
      'dev/changelog-coverage-baseline.json if it is genuinely intentional.',
  }))
  const stale = collectStaleBaselineEntries(root).map((id) => ({
    code: 'changelog.coverage.stale-baseline',
    message:
      `${id} is listed in dev/changelog-coverage-baseline.json as an uncovered ` +
      'gap, but the changelog now covers it. Remove the entry so the ratchet ' +
      'reflects reality; a baseline that cannot shrink over-credits itself.',
  }))
  return [...gaps, ...stale]
}

if (import.meta.main) {
  const issues = collectChangelogCoverageIssues(process.cwd())
  for (const issue of issues) console.log(`- [${issue.code}] ${issue.message}`)
  const abbreviated = collectAbbreviatedReferences(
    fs.readFileSync('CHANGELOG.md', 'utf8'),
  )
  if (abbreviated.length > 0) {
    console.log(
      `ℹ ${abbreviated.length} abbreviated FID reference(s) — visible but not a failure:`,
    )
    for (const ref of abbreviated.slice(0, 10)) {
      console.log(`  ${ref.text}  (in "${ref.section}")`)
    }
  }
  console.log(
    issues.length === 0
      ? 'changelog-coverage: PASS'
      : `changelog-coverage: FAIL (${issues.length} issue(s))`,
  )
  process.exitCode = issues.length === 0 ? 0 : 1
}

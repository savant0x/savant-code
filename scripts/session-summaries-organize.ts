#!/usr/bin/env bun
/**
 * FID-2026-1019-001 — session-summary month organization.
 *
 * `dev/session-summaries/` grows one flat file per session. This module groups
 * those files into `YYYY-MM/` buckets derived from each filename, so the audit
 * trail stays navigable without renaming or rewriting a single summary.
 *
 * Bounds:
 * - Pure planning then apply: `planSessionSummaryOrganization` never mutates, so
 *   `--check` and `--dry-run` report exactly what the apply path will do.
 * - Fail-closed on collisions: an existing destination is never overwritten;
 *   the file stays at the root and is reported instead.
 * - Idempotent: already-grouped files are not rescanned, so a second run is a
 *   no-op.
 * - Only top-level dated files are candidates; the day prefix decides the
 *   bucket, whatever the extension (`2026-10-17-fid-worktrees-tests.log` and
 *   `2026-10-03-...png` group with that month's summaries). `README.md`,
 *   dotfiles, directories and undated notes are left where they are.
 * - Filenames are never rewritten; only the directory changes.
 *
 * CLI: `bun run session-summaries:organize` (SessionEnd invokes it through
 * `scripts/session-end-review.ts`).
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

export const SESSION_SUMMARY_DIR = path.join('dev', 'session-summaries')

/** `2026-10-19-title.md` — the convention for new summaries. */
const CANONICAL_NAME = /^(\d{4})-(\d{2})-(\d{2})(?:[ -].*)?$/i
/** `2026-0823-2328-title.md` — pre-convention `YYYY-MMDD` names. */
const COMPACT_NAME = /^(\d{4})-(\d{2})(\d{2})(?:[ -].*)?$/i
/** Files that carry documentation or housekeeping, never a summary date. */
const PRESERVED_NAMES = new Set(['readme.md', '.gitkeep'])

export type SummaryMonth =
  | { ok: true; month: string; day: string; legacy: boolean }
  | { ok: false }

export type SummaryMove = {
  /** File name at the root, e.g. `2026-10-19-audit.md`. */
  file: string
  /** Relative destination, e.g. `2026-10/2026-10-19-audit.md`. */
  target: string
  month: string
  /** True when the name used the pre-convention `YYYY-MMDD` shape. */
  legacy: boolean
}

export type SummaryConflict = { file: string; target: string }

export type SummaryPlan = {
  root: string
  moves: SummaryMove[]
  conflicts: SummaryConflict[]
  /** Root-level markdown that carries no parseable month. */
  undated: string[]
  /** Month buckets that already exist (and how many files each holds). */
  months: Record<string, number>
}

export type SummaryReport = SummaryPlan & {
  /** Names actually renamed; `0` under `--dry-run`. */
  applied: number
  dryRun: boolean
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Derive the `YYYY-MM` bucket from a summary filename. */
export function summaryMonth(file: string): SummaryMonth {
  // The extension never carries meaning here (`2026-10-17-gates.log`), so the
  // date is parsed from the stem and the original name is kept intact.
  const stem = file.replace(/\.[^.]+$/, '')
  const canonical = CANONICAL_NAME.exec(stem)
  if (canonical) {
    const [, year, month, day] = canonical
    const y = Number(year)
    const m = Number(month)
    const d = Number(day)
    if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return { ok: false }
    return { ok: true, month: `${year}-${month}`, day, legacy: false }
  }
  const compact = COMPACT_NAME.exec(stem)
  if (compact) {
    const [, year, month, day] = compact
    const y = Number(year)
    const m = Number(month)
    const d = Number(day)
    if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return { ok: false }
    return { ok: true, month: `${year}-${month}`, day, legacy: true }
  }
  return { ok: false }
}

function countMonthFiles(directory: string): number {
  try {
    return fs
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile()).length
  } catch {
    return 0
  }
}

/**
 * Rewrite a legacy flat `dev/session-summaries/<name>` reference to its month
 * bucket when (and only when) the flat file is gone and the bucketed file
 * exists. Records, the canonical learning rules and the lesson catalog cite
 * summaries by their old flat path; grouping must not turn those into dead
 * references or force a rewrite of historical text.
 *
 * Fail-closed: anything outside `dev/session-summaries/`, any nested or
 * traversing name and any undated name is returned unchanged, so each caller's
 * own containment check still sees what it saw before.
 */
export function sessionSummaryReference(root: string, reference: string): string {
  const normalized = reference.replace(/\\/g, '/')
  const prefix = `${SESSION_SUMMARY_DIR.replace(/\\/g, '/')}/`
  if (!normalized.startsWith(prefix)) return reference
  const name = normalized.slice(prefix.length)
  if (name === '' || name !== path.posix.basename(name)) return reference
  const parsed = summaryMonth(name)
  if (!parsed.ok) return reference
  if (fs.existsSync(path.resolve(root, normalized))) return reference
  const bucketed = `${prefix}${parsed.month}/${name}`
  return fs.existsSync(path.resolve(root, bucketed)) ? bucketed : reference
}

/**
 * Read the directory and describe the grouping that `apply` would perform.
 * No filesystem mutation: safe for `--check`, tests and dry runs.
 */
export function planSessionSummaryOrganization(root: string): SummaryPlan {
  const directory = path.isAbsolute(root) ? root : path.resolve(root)
  const plan: SummaryPlan = {
    root: directory,
    moves: [],
    conflicts: [],
    undated: [],
    months: {},
  }
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true })
  } catch {
    return plan
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (/^\d{4}-\d{2}$/.test(entry.name)) {
        plan.months[entry.name] = countMonthFiles(path.join(directory, entry.name))
      }
      continue
    }
    if (!entry.isFile()) continue
    if (PRESERVED_NAMES.has(entry.name.toLowerCase())) continue
    if (entry.name.startsWith('.')) continue
    const parsed = summaryMonth(entry.name)
    if (!parsed.ok) {
      // Undated notes cannot be placed without guessing; report, never move.
      plan.undated.push(entry.name)
      continue
    }
    const target = `${parsed.month}/${entry.name}`
    if (fs.existsSync(path.join(directory, target))) {
      plan.conflicts.push({ file: entry.name, target })
      continue
    }
    plan.moves.push({
      file: entry.name,
      target,
      month: parsed.month,
      legacy: parsed.legacy,
    })
  }
  plan.moves.sort((a, b) => a.file.localeCompare(b.file))
  plan.undated.sort()
  plan.conflicts.sort((a, b) => a.file.localeCompare(b.file))
  return plan
}

/**
 * Group the summaries into month buckets. `dryRun` reports the plan without
 * touching the directory.
 */
export function organizeSessionSummaries(
  root: string,
  opts: { dryRun?: boolean } = {},
): SummaryReport {
  const plan = planSessionSummaryOrganization(root)
  const dryRun = opts.dryRun ?? false
  let applied = 0
  if (!dryRun) {
    for (const move of plan.moves) {
      const monthDir = path.join(plan.root, move.month)
      fs.mkdirSync(monthDir, { recursive: true })
      fs.renameSync(path.join(plan.root, move.file), path.join(plan.root, move.target))
      applied += 1
      plan.months[move.month] = (plan.months[move.month] ?? 0) + 1
    }
  }
  return { ...plan, applied, dryRun }
}

/**
 * One-line verdict for the session-end report. Returns `null` when there is
 * nothing worth saying (the common case after the first run).
 */
export function sessionSummaryOrganizationLine(
  report: SummaryReport,
  displayRoot = SESSION_SUMMARY_DIR,
): string | null {
  if (report.conflicts.length > 0) {
    return (
      `session-summaries: ${report.conflicts.length} file(s) left in ${displayRoot} — ` +
      `a month bucket already holds the same name; resolve by hand, nothing was overwritten.`
    )
  }
  if (report.undated.length > 0) {
    return (
      `session-summaries: ${report.undated.length} undated file(s) left in ${displayRoot} ` +
      `(name them YYYY-MM-DD-* so the monthly grouping can place them).`
    )
  }
  if (report.moves.length > 0 && !report.dryRun) {
    // Buckets this run touched, not every bucket that exists — a single new
    // summary must not report the whole archive's month count.
    const months = new Set(report.moves.map((move) => move.month)).size
    return `session-summaries: ${report.moves.length} summary file(s) grouped into ${months} month bucket(s).`
  }
  return null
}

function parseArgs(argv: string[]): {
  root: string
  check: boolean
  dryRun: boolean
} {
  let root = path.join(import.meta.dir, '..', SESSION_SUMMARY_DIR)
  let check = false
  let dryRun = false
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!
    if (arg === '--check') check = true
    else if (arg === '--dry-run') dryRun = true
    else if (arg === '--root') {
      const value = argv[index + 1]
      if (value !== undefined) {
        root = path.resolve(value)
        index += 1
      }
    }
  }
  return { root, check, dryRun }
}

if (import.meta.main) {
  const args = parseArgs(Bun.argv.slice(2))
  const report = organizeSessionSummaries(args.root, { dryRun: args.dryRun || args.check })
  const pending = report.moves.length + report.conflicts.length
  for (const move of report.moves) {
    process.stdout.write(`${args.check || args.dryRun ? 'would group' : 'grouped'}: ${move.file} -> ${move.target}\n`)
  }
  for (const conflict of report.conflicts) {
    process.stderr.write(`collision: ${conflict.file} -> ${conflict.target} (left in place)\n`)
  }
  for (const undated of report.undated) {
    process.stdout.write(`undated: ${undated} (left in place)\n`)
  }
  if (args.check) {
    if (pending > 0) {
      process.stderr.write(
        `session-summaries: ${pending} file(s) still need month grouping under ${args.root}\n`,
      )
      process.exitCode = 1
    } else {
      process.stdout.write(`session-summaries: grouped by month (${args.root})\n`)
    }
  } else {
    const line = sessionSummaryOrganizationLine(report)
    if (line !== null) process.stdout.write(`${line}\n`)
    if (report.conflicts.length > 0) process.exitCode = 1
  }
}

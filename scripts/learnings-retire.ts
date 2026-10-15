#!/usr/bin/env bun
/**
 * FID-2026-0824-012 S3-C — LEARNINGS.md retirement tier (move-only).
 *
 * dev/LEARNINGS.md is boot-read every session and currently sits near the
 * ~1,200-line cap. Without a retirement path, promotion deadlocks: every new
 * canonical rule either blows the context budget or waits forever.
 *
 * Contract:
 *   - MOVE-ONLY, NEVER DELETE — retired entries are appended verbatim to
 *     `dev/LEARNINGS-RETIRED.md` (append-only archive; existing entries are
 *     never rewritten), so no rule is ever lost.
 *   - Retirement candidates: entries with `Status: superseded | historical`
 *     first; then the OLDEST entries (by Date) until the file is under the
 *     line cap.
 *   - `learnings:check` must pass after retirement (retiring malformed or
 *     stale entries only ever removes issues).
 *
 * CLI: `bun run learnings:retire [--dry-run] [--cap <lines>]`
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import { lessonSpans } from './learnings-locator.js'
import { removeLessonSpans } from './learnings-retirement-spans.js'
import {
  commitRetirement,
  resumeRetirement,
} from './learnings-retirement-transaction.js'

import type { RetirementFileWriter } from './learnings-retirement-transaction.js'

export const LEARNINGS_PATH = path.join('dev', 'LEARNINGS.md')
export const RETIRED_PATH = path.join('dev', 'LEARNINGS-RETIRED.md')
/**
 * FID-2026-1012-011: the move record. Retirement is still the operator's
 * decision and still move-only, but what moved — and when, and why, and where
 * it went — is now a durable, machine-readable artifact rather than only a git
 * history. `FID-2026-1012-012` resolves titles through the shared live/retired index.
 */
export const MOVE_RECORD_PATH = path.join('dev', 'learnings-move-log.jsonl')
export const DEFAULT_LINE_CAP = 1200

export interface LearningsMoveRecord {
  /** The retired lesson's title, verbatim. */
  title: string
  /** The lesson's own Date field (empty when the entry carries none). */
  date: string
  /** Why it was retired (`status superseded`, `oldest entry (line cap)`, …). */
  reason: string
  /** Where its content now lives — the append-only archive. */
  destination: string
  /** When the move completed. */
  retiredAt: string
  linesBefore: number
  linesAfter: number
}

export type RetireResult = {
  retired: { title: string; reason: string }[]
  linesBefore: number
  linesAfter: number
}

function splitEntries(content: string): { title: string; block: string }[] {
  return lessonSpans(content).map(({ title, block }) => ({ title, block }))
}

function fieldOf(block: string, name: string): string {
  const re = new RegExp(`^- \\*\\*${name}:\\*\\*\\s*(.+)$`, 'm')
  const match = block.match(re)
  return match?.[1]?.trim() ?? ''
}

function dateOf(block: string): number {
  const raw = fieldOf(block, 'Date')
  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

/** How many lines the rewritten file will occupy (matches applyRetirement). */
function measure(kept: { title: string; block: string }[]): number {
  if (kept.length === 0) return 1
  return (
    '# LEARNINGS\n\n'.split(/\r?\n/).length -
    1 +
    kept
      .map((e) => e.block.trim().split(/\r?\n/).length)
      .reduce((a, b) => a + b, 0) +
    (kept.length - 1) * 2
  )
}

/**
 * Retire entries (move-only): superseded/historical first, then oldest, until
 * the remaining file is at or under the line cap. Returns what was retired
 * and the before/after line counts.
 */
export function retireLessons(
  content: string,
  opts: { cap?: number; now?: number } = {},
): RetireResult {
  const cap = opts.cap ?? DEFAULT_LINE_CAP
  const entries = splitEntries(content)
  const totalLines = content.split(/\r?\n/).length
  if (entries.length === 0 || totalLines <= cap) {
    return { retired: [], linesBefore: totalLines, linesAfter: totalLines }
  }

  const statusRank = (block: string): number => {
    const status = fieldOf(block, 'Status')
    if (status === 'superseded') return 0
    if (status === 'historical') return 1
    if (status === 'needs-review') return 2
    return 3
  }

  // Stable sort: superseded/historical first, then oldest by date.
  const sorted = [...entries].sort((a, b) => {
    const rankDiff = statusRank(a.block) - statusRank(b.block)
    if (rankDiff !== 0) return rankDiff
    return dateOf(a.block) - dateOf(b.block)
  })

  if (!Number.isFinite(cap))
    throw new TypeError('learnings:retire: cap must be a finite line count')
  const retired: { title: string; reason: string }[] = []
  const kept = [...entries]
  for (const candidate of sorted) {
    if (kept.length === 0) break
    if (measure(kept) <= cap) break
    const idx = kept.indexOf(candidate)
    if (idx === -1) continue
    kept.splice(idx, 1)
    const status = fieldOf(candidate.block, 'Status')
    retired.push({
      title: candidate.title,
      reason:
        status === 'superseded' || status === 'historical'
          ? `status ${status}`
          : 'oldest entry (line cap)',
    })
  }

  return { retired, linesBefore: totalLines, linesAfter: measure(kept) }
}

/** Apply retirement to disk: append retired blocks to the archive, rewrite
 * LEARNINGS.md with the kept blocks. The archive is append-only — existing
 * archive content is read back and preserved verbatim. */
export function applyRetirement(
  rootDir: string,
  opts: { cap?: number; write?: RetirementFileWriter } = {},
): RetireResult {
  const recovered = resumeRetirement(rootDir, opts.write)
  if (recovered) return recovered
  const learningsFile = path.join(rootDir, LEARNINGS_PATH)
  if (!fs.existsSync(learningsFile)) {
    return { retired: [], linesBefore: 0, linesAfter: 0 }
  }
  const content = fs.readFileSync(learningsFile, 'utf8')
  const result = retireLessons(content, opts)
  if (result.retired.length === 0) return result

  const retiredTitles = new Set(result.retired.map((r) => r.title))
  const retired = splitEntries(content).filter((e) =>
    retiredTitles.has(e.title),
  )

  const archiveBody = retired.map((e) => e.block.trimEnd()).join('\n\n---\n\n')
  const ledgerAfter = removeLessonSpans(content, retiredTitles)
  return commitRetirement({
    root: rootDir,
    ledgerBefore: content,
    ledgerAfter,
    archiveBody,
    write: opts.write,
    records: retired.map((entry) => ({
      title: entry.title,
      date: fieldOf(entry.block, 'Date'),
      reason:
        result.retired.find((candidate) => candidate.title === entry.title)
          ?.reason ?? 'line cap',
      destination: RETIRED_PATH,
      retiredAt: new Date().toISOString(),
      linesBefore: result.linesBefore,
      linesAfter: ledgerAfter.split(/\r?\n/).length,
    })),
  })
}

/** Parse `--cap <n>` defensively: absent flag falls back to the default, and
 * any non-finite value (NaN from a stray argv index or bad input) is rejected
 * rather than silently poisoning the retirement loop. */
function parseCap(argv: readonly string[]): number {
  const index = argv.indexOf('--cap')
  if (index === -1) return DEFAULT_LINE_CAP
  const raw = argv[index + 1]
  const parsed = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 0)
    throw new Error(
      `learnings:retire: --cap requires a non-negative integer, got ${JSON.stringify(raw)}`,
    )
  return parsed
}

if (import.meta.main) {
  const rootDir = path.resolve(import.meta.dir, '..')
  const cap = parseCap(process.argv)
  if (process.argv.includes('--dry-run')) {
    const content = fs.existsSync(path.join(rootDir, LEARNINGS_PATH))
      ? fs.readFileSync(path.join(rootDir, LEARNINGS_PATH), 'utf8')
      : ''
    const result = retireLessons(content, { cap })
    console.log(
      `learnings:retire (dry-run): ${result.retired.length} candidate(s); ${result.linesBefore} → ${result.linesAfter} lines (cap ${cap})`,
    )
    for (const r of result.retired)
      console.log(`- retire: ${r.title} (${r.reason})`)
    process.exit(0)
  }
  const result = applyRetirement(rootDir, { cap })
  console.log(
    `learnings:retire: retired ${result.retired.length} entry/entries; ${result.linesBefore} → ${result.linesAfter} lines`,
  )
  if (result.retired.length > 0)
    console.log(`learnings:retire: move record appended to ${MOVE_RECORD_PATH}`)
  for (const r of result.retired)
    console.log(`- retired: ${r.title} (${r.reason})`)
}

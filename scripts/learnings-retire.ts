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

export const LEARNINGS_PATH = path.join('dev', 'LEARNINGS.md')
export const RETIRED_PATH = path.join('dev', 'LEARNINGS-RETIRED.md')
export const DEFAULT_LINE_CAP = 1200

export type RetireResult = {
  retired: { title: string; reason: string }[]
  linesBefore: number
  linesAfter: number
}

function splitEntries(content: string): { title: string; block: string }[] {
  const parts = content.split(/^## Lesson:/m)
  const entries: { title: string; block: string }[] = []
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i]
    const title = (block.split('\n', 1)[0] ?? '').trim()
    entries.push({ title, block: `## Lesson:${block}` })
  }
  return entries
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
  opts: { cap?: number } = {},
): RetireResult {
  const learningsFile = path.join(rootDir, LEARNINGS_PATH)
  if (!fs.existsSync(learningsFile)) {
    return { retired: [], linesBefore: 0, linesAfter: 0 }
  }
  const content = fs.readFileSync(learningsFile, 'utf8')
  const result = retireLessons(content, opts)
  if (result.retired.length === 0) return result

  const entries = splitEntries(content)
  const retiredBlocks = new Set(result.retired.map((r) => r.title))
  const kept = entries.filter((e) => !retiredBlocks.has(e.title))
  const retired = entries.filter((e) => retiredBlocks.has(e.title))

  // Archive: append-only — preserve whatever is already there.
  const retiredFile = path.join(rootDir, RETIRED_PATH)
  const archiveHead = fs.existsSync(retiredFile)
    ? fs.readFileSync(retiredFile, 'utf8').trimEnd()
    : '# Retired Learnings (FID-2026-0824-012 S3-C — move-only archive)\n\n' +
      '> Entries retired from dev/LEARNINGS.md are appended here verbatim.\n' +
      '> Rules are never deleted — this archive is append-only.\n\n'
  const archiveBody = retired.map((e) => e.block.trimEnd()).join('\n\n---\n\n')
  fs.writeFileSync(retiredFile, `${archiveHead}\n\n${archiveBody}\n`, 'utf8')
  fs.writeFileSync(
    learningsFile,
    '# LEARNINGS\n\n' + kept.map((e) => e.block.trim()).join('\n\n') + '\n',
    'utf8',
  )
  return result
}

if (import.meta.main) {
  const rootDir = path.resolve(import.meta.dir, '..')
  const cap = Number.parseInt(
    process.argv[process.argv.indexOf('--cap') + 1] ?? String(DEFAULT_LINE_CAP),
    10,
  )
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
  for (const r of result.retired)
    console.log(`- retired: ${r.title} (${r.reason})`)
}

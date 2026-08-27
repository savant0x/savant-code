#!/usr/bin/env bun
/**
 * FID-2026-0824-012 S1-C — dedup / recurrence / compaction layer over the
 * experience ledger.
 *
 * The capture path writes ONE immutable event per record (S1-A); this module
 * owns all aggregation:
 *
 *   - `groupByDedupKey` — sha256(toolName + normalizedErrorFirstLine) groups
 *     identical failures (the NUL-separated key lives in common so the sink
 *     and the analyzer can never disagree).
 *   - `computeRecurrences` — the persistent cross-session frequency counter:
 *     a pattern must appear ≥ `minFrequency` (default 3) times within a
 *     rolling `windowDays` (default 14) sliding window. Deliberately NOT a
 *     per-session counter — a pattern recurring once per session would never
 *     promote.
 *   - `isExpectedFailure` — noise filter for known-benign error classes
 *     (broad-search 404s etc.) so they never count toward promotion.
 *   - `purgeExpiredTraces` — PreCompact compaction: drops records older than
 *     the window. Promoted lessons live durably in LEARNINGS.md + FIDs, so
 *     purging the raw trace can never destroy evidence that already promoted.
 *
 * CLI:
 *   bun run experiences:dedup            — report recurrences + stats
 *   bun run experiences:dedup --purge    — rewrite the ledger, keep 14 days
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  EXPERIENCES_DIR_NAME,
  RAW_TRACES_FILE_NAME,
} from '@savant-code/common/types/experience'
import { experienceDedupKey } from '@savant-code/common/util/experiences'

import type { ExperienceRecord } from '@savant-code/common/types/experience'

export const DEFAULT_WINDOW_DAYS = 14
export const DEFAULT_MIN_FREQUENCY = 3
const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Known-benign failure classes that must never promote to a lesson.
 * Deliberately narrow: `command not found` (a missing binary — a REAL,
 * promotable environment gap) is NOT expected, while HTTP 404 / empty
 * web-search result classes are.
 */
const EXPECTED_FAILURE_PATTERNS: RegExp[] = [
  // Broad-search 404 / empty-result classes (e.g. web_search misses).
  /\b404\b/i,
  /no results? found/i,
]

/** Fail-open parse: one line per record; malformed lines are skipped. */
export function parseExperienceLedger(content: string): ExperienceRecord[] {
  const records: ExperienceRecord[] = []
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    try {
      const parsed = JSON.parse(trimmed) as ExperienceRecord
      if (
        typeof parsed?.ts === 'string' &&
        typeof parsed?.toolName === 'string' &&
        typeof parsed?.errorFirstLine === 'string' &&
        typeof parsed?.sessionId === 'string'
      ) {
        records.push(parsed)
      }
    } catch {
      // Malformed line — skip, never fail the analysis.
    }
  }
  return records
}

export function readExperienceLedger(rootDir: string): ExperienceRecord[] {
  const file = path.join(rootDir, EXPERIENCES_DIR_NAME, RAW_TRACES_FILE_NAME)
  if (!fs.existsSync(file)) return []
  return parseExperienceLedger(fs.readFileSync(file, 'utf8'))
}

export function isExpectedFailure(errorFirstLine: string): boolean {
  return EXPECTED_FAILURE_PATTERNS.some((re) => re.test(errorFirstLine))
}

export type DedupGroup = {
  key: string
  toolName: string
  errorFirstLine: string
  records: ExperienceRecord[]
}

/** Group records by dedup key, preserving first-seen order. */
export function groupByDedupKey(
  records: ExperienceRecord[],
): Map<string, DedupGroup> {
  const groups = new Map<string, DedupGroup>()
  for (const record of records) {
    const key = experienceDedupKey(record.toolName, record.errorFirstLine)
    const existing = groups.get(key)
    if (existing) {
      existing.records.push(record)
    } else {
      groups.set(key, {
        key,
        toolName: record.toolName,
        errorFirstLine: record.errorFirstLine,
        records: [record],
      })
    }
  }
  return groups
}

export type Recurrence = {
  key: string
  toolName: string
  errorFirstLine: string
  /** Count within the rolling window (expected failures excluded). */
  count: number
  /** Total count including expected failures and out-of-window records. */
  totalCount: number
  firstTs: string
  lastTs: string
}

export type RecurrenceOptions = {
  windowDays?: number
  minFrequency?: number
  now?: number
}

/**
 * Persistent cross-session recurrence detector: patterns with ≥ minFrequency
 * occurrences within the last `windowDays` (rolling, not calendar). Records
 * whose first line matches an expected-failure pattern never count toward the
 * frequency.
 */
export function computeRecurrences(
  records: ExperienceRecord[],
  options: RecurrenceOptions = {},
): Recurrence[] {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS
  const minFrequency = options.minFrequency ?? DEFAULT_MIN_FREQUENCY
  const now = options.now ?? Date.now()
  const cutoff = now - windowDays * MS_PER_DAY

  const recurrences: Recurrence[] = []
  for (const group of groupByDedupKey(records).values()) {
    const inWindow = group.records.filter((record) => {
      const ts = Date.parse(record.ts)
      return Number.isFinite(ts) && ts >= cutoff
    })
    const inWindowFiltered = inWindow.filter(
      (record) => !isExpectedFailure(record.errorFirstLine),
    )
    if (inWindowFiltered.length < minFrequency) continue
    const timestamps = inWindow
      .map((record) => Date.parse(record.ts))
      .filter((ts) => Number.isFinite(ts))
      .sort((a, b) => a - b)
    recurrences.push({
      key: group.key,
      toolName: group.toolName,
      errorFirstLine: group.errorFirstLine,
      count: inWindowFiltered.length,
      totalCount: group.records.length,
      firstTs:
        timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : '',
      lastTs:
        timestamps.length > 0
          ? new Date(timestamps[timestamps.length - 1]).toISOString()
          : '',
    })
  }
  return recurrences.sort((a, b) => b.count - a.count)
}

/** Compaction: keep only records within `windowDays` of `now`. */
export function purgeExpiredTraces(
  records: ExperienceRecord[],
  options: { windowDays?: number; now?: number } = {},
): ExperienceRecord[] {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS
  const now = options.now ?? Date.now()
  const cutoff = now - windowDays * MS_PER_DAY
  return records.filter((record) => {
    const ts = Date.parse(record.ts)
    return Number.isFinite(ts) && ts >= cutoff
  })
}

function report(rootDir: string): void {
  const records = readExperienceLedger(rootDir)
  const recurrences = computeRecurrences(records)
  const groups = groupByDedupKey(records)
  console.log(
    `experiences: ${records.length} record(s), ${groups.size} unique pattern(s), ${recurrences.length} recurrence(s) ≥ ${DEFAULT_MIN_FREQUENCY} in ${DEFAULT_WINDOW_DAYS}d`,
  )
  for (const r of recurrences) {
    console.log(
      `- [${r.count}×] ${r.toolName}: ${r.errorFirstLine.slice(0, 120)}`,
    )
  }
}

function purge(rootDir: string): void {
  const file = path.join(rootDir, EXPERIENCES_DIR_NAME, RAW_TRACES_FILE_NAME)
  if (!fs.existsSync(file)) {
    console.log('experiences: purge — no ledger present')
    return
  }
  const kept = purgeExpiredTraces(readExperienceLedger(rootDir))
  const content = kept.map((record) => JSON.stringify(record)).join('\n')
  fs.writeFileSync(file, content === '' ? '' : `${content}\n`, 'utf8')
  console.log(
    `experiences: purge — kept ${kept.length} record(s) within ${DEFAULT_WINDOW_DAYS}d`,
  )
}

if (import.meta.main) {
  const rootDir = path.resolve(import.meta.dir, '..')
  if (process.argv.includes('--purge')) {
    purge(rootDir)
  } else {
    report(rootDir)
  }
}

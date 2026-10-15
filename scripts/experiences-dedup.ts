#!/usr/bin/env bun
/**
 * FID-2026-0824-012 S1-C — dedup / recurrence / compaction layer over the
 * experience ledger.
 *
 * The capture path writes ONE immutable event per record (S1-A); this module
 * owns all aggregation:
 *
 *   - `groupByDedupKey` — shared versioned cause identity groups failures
 *     across changing budgets/payloads while preserving unknown causes.
 *   - `computeRecurrences` — the persistent cross-session frequency counter:
 *     a pattern must appear ≥ `minFrequency` (default 3) times within a
 *     rolling `windowDays` (default 14) sliding window. Deliberately NOT a
 *     per-session counter — a pattern recurring once per session would never
 *     promote.
 *   - `isExpectedFailure` — explicit contextual expectedness only. Unknown
 *     outcomes stay investigable; error words cannot establish expectedness.
 *   - `purgeExpiredTraces` — PreCompact compaction: drops records older than
 *     the window. Promoted lessons live durably in LEARNINGS.md + FIDs, so
 *     purging the raw trace can never destroy evidence that already promoted.
 *
 * CLI:
 *   bun run experiences:dedup            — report recurrences + stats
 *   bun run experiences:dedup --purge    — rewrite the ledger, keep 14 days
 */

import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  EXPERIENCES_DIR_NAME,
  RAW_TRACES_FILE_NAME,
  experienceRecordSchema,
} from '@savant-code/common/types/experience'
import {
  experienceClassIdentity,
  isExpectedClass,
} from '@savant-code/common/util/experience-classes'

import type { ExperienceRecord } from '@savant-code/common/types/experience'

export const DEFAULT_WINDOW_DAYS = 14
export const DEFAULT_MIN_FREQUENCY = 3
/**
 * FID-2026-1005-003 Step 1: a repeated failure is a candidate signal only
 * when it occurred across ≥ 3 DISTINCT sessions — three retries inside one
 * session are one investigation, not three independent failures.
 */
export const DEFAULT_MIN_SESSIONS = 3
const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Fail-open parse: one line per record; malformed lines are skipped. */
export function parseExperienceLedger(content: string): ExperienceRecord[] {
  const records: ExperienceRecord[] = []
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    try {
      const parsed = experienceRecordSchema.safeParse(JSON.parse(trimmed))
      if (parsed.success) records.push(parsed.data)
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

/** Delegates to the one classification rule (FID-2026-1012-024 Loop 12). */
export function isExpectedFailure(
  record: Pick<ExperienceRecord, 'expectedness'>,
): boolean {
  return isExpectedClass(record)
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
    // Existing wiki/proposal consumers require a filesystem-safe 64-hex key.
    const key = createHash('sha256')
      .update(experienceClassIdentity(record).key)
      .digest('hex')
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
  /**
   * FID-2026-1005-003 Step 1: distinct session ids behind the in-window
   * records. Promotion gates on this, not on `count` alone.
   */
  distinctSessions: number
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
 * explicitly marked expected never count toward the frequency. All historical
 * undetermined outcomes remain visible and count toward investigation.
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
      return Number.isFinite(ts) && ts >= cutoff && ts <= now
    })
    const inWindowFiltered = inWindow.filter(
      (record) => !isExpectedFailure(record),
    )
    if (inWindowFiltered.length < minFrequency) continue
    // FID-2026-1005-003 Step 1: distinct-session count over the same
    // filtered set — retries inside one session do not widen this.
    const distinctSessions = new Set(
      inWindowFiltered.map((record) => record.sessionId),
    ).size
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
      distinctSessions,
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
      `- [${r.count}× / ${r.distinctSessions} session(s)] ${r.toolName}: ${r.errorFirstLine.slice(0, 120)}`,
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

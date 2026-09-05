#!/usr/bin/env bun
/**
 * FID-2026-0824-012 S3-A — session-end review (mechanical core).
 *
 * Runs at SessionEnd (wired as a hook command) to perform the deterministic
 * half of the Scribe review contract WITHOUT an LLM:
 *
 *   1. Reads dev/experiences/raw-traces.jsonl and computes cross-session
 *      recurrences (≥3 within the rolling 14-day window).
 *   2. Refreshes dev/agenda.md — hard-capped at 50 lines, 1-3 active
 *      high-leverage capabilities/anti-patterns (RangeKing-style learning
 *      agenda; the Orchestrator reads it at next-session intake).
 *   3. Prints FID-routing candidates for the Scribe/Orchestrator (recurrence
 *      items that meet the promotion bar route to FIDs per the hybrid
 *      routing rule).
 *
 * Bounds (operator decision: cost is not a constraint; determinism is):
 * idempotent (agenda is a pure function of the current ledger), single-writer
 * (rewrites the agenda file under one write), tail-bounded reads.
 *
 * CLI: `bun run session-end:review` (also invoked by the SessionEnd hook).
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  computeRecurrences,
  readExperienceLedger,
} from './experiences-dedup.js'

export const AGENDA_MAX_LINES = 50
export const AGENDA_MAX_ITEMS = 3
export const AGENDA_PATH = path.join('dev', 'agenda.md')

export type AgendaItem = {
  toolName: string
  errorFirstLine: string
  count: number
  totalCount: number
}

export type SessionEndReview = {
  items: AgendaItem[]
  agenda: string
  /** Candidate FID-routing notes (line-bounded). */
  routing: string[]
}

/** Build the agenda document from the current recurrences (≤ 50 lines). */
export function buildAgenda(
  recurrences: ReturnType<typeof computeRecurrences>,
  opts: { maxItems?: number } = {},
): { items: AgendaItem[]; agenda: string; routing: string[] } {
  const maxItems = opts.maxItems ?? AGENDA_MAX_ITEMS
  const items: AgendaItem[] = recurrences.slice(0, maxItems).map((r) => ({
    toolName: r.toolName,
    errorFirstLine: r.errorFirstLine,
    count: r.count,
    totalCount: r.totalCount,
  }))
  const lines: string[] = [
    '# Learning Agenda (FID-2026-0824-012 S3-A)',
    '',
    '> Auto-refreshed at session end from dev/experiences/raw-traces.jsonl.',
    '> 1-3 active high-leverage capabilities/anti-patterns; ≤ 50 lines.',
    '',
  ]
  if (items.length === 0) {
    lines.push('_No recurring failure patterns in the last 14 days._', '')
  } else {
    for (const item of items) {
      lines.push(
        `- [ ] **${item.toolName}** — ${item.errorFirstLine.slice(0, 100)}`,
        `      recurrences: ${item.count} (total ${item.totalCount}) — promote via FID when resolved+verified`,
        '',
      )
    }
  }
  const routing: string[] = []
  for (const item of items) {
    routing.push(
      `FID-route: ${item.toolName} · ${item.errorFirstLine.slice(0, 80)} — ` +
        `recurred ${item.count}× in 14d (≥3 bar). Draft a RED-phase FID; ` +
        `Orchestrator direct write when <100 lines (hybrid routing rule).`,
    )
  }
  const agenda = lines.join('\n').trimEnd() + '\n'
  return { items, agenda, routing }
}

/** Refresh dev/agenda.md from the ledger. Returns the review result. */
export function runSessionEndReview(
  rootDir: string,
  opts: { now?: number } = {},
): SessionEndReview {
  const records = readExperienceLedger(rootDir)
  const recurrences = computeRecurrences(records, { now: opts.now })
  const built = buildAgenda(recurrences)
  const agendaFile = path.join(rootDir, AGENDA_PATH)
  fs.mkdirSync(path.dirname(agendaFile), { recursive: true })
  fs.writeFileSync(agendaFile, built.agenda, 'utf8')
  return {
    items: built.items,
    agenda: built.agenda,
    routing: built.routing,
  }
}

if (import.meta.main) {
  const rootDir = path.resolve(import.meta.dir, '..')
  const review = runSessionEndReview(rootDir)
  console.log(
    `session-end:review: ${review.items.length} agenda item(s) written to ${AGENDA_PATH}`,
  )
  for (const note of review.routing) console.log(`- ${note}`)
}

#!/usr/bin/env bun
/**
 * FID-2026-0824-012 S3-A — session-end review (mechanical core).
 *
 * SessionEnd hook: computes recurrences (≥3 in 14 days), refreshes the
 * boot-read dev/agenda.md (≤50 lines, ≤3 patterns), and prints FID routing.
 * Independent internal follow-ups retain observation and comparison work.
 *
 * Bounds (operator decision: cost is not a constraint; determinism is):
 * idempotent (agenda is a pure function of the current ledger), single-writer
 * (rewrites the agenda file under one write), tail-bounded reads.
 * CLI: `bun run session-end:review` (also invoked by the SessionEnd hook).
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  countedUnitHead,
  summarizeExperienceClasses,
} from '@savant-code/common/util/experience-classes'
import { proposalsForSession } from '@savant-code/common/util/skill-proposals'
import { updateWikiPattern } from '@savant-code/common/util/skill-wiki'

import {
  computeRecurrences,
  readExperienceLedger,
} from './experiences-dedup.js'
import { repairDraftRoutingNotes } from './experiences-repair-drafts'
import {
  internalFollowupAgenda,
  internalFollowupNotes,
} from './internal-followups'
import { featureRoutingNotes } from './lesson-feature-pipeline'
import { orphanSweepLine } from './orphan-sweep'
import {
  printSessionEndReview,
  quarantineAlertNote,
  skillLifecycleReport,
  telemetryReportLines,
} from './session-end-notices'
import {
  organizeSessionSummaries,
  sessionSummaryOrganizationLine,
} from './session-summaries-organize'

export {
  quarantineAlertNote,
  skillLifecycleReportLines,
} from './session-end-notices'

import type { SkillLifecycleEvent } from '@savant-code/common/util/skill-lifecycle-events'

export const AGENDA_MAX_LINES = 50
export const AGENDA_MAX_ITEMS = 3
/**
 * MD013 column bound for the agenda file (`lint:md` runs repository-wide, and
 * the agenda is a committed markdown artifact, not a console line). Decision
 * lines budget what remains after their own prefix rather than a fixed slice.
 */
export const AGENDA_MAX_LINE = 120
export const AGENDA_PATH = path.join('dev', 'agenda.md')

export type AgendaItem = {
  toolName: string
  /** Classification cause the count belongs to — the counted unit. */
  cause: string
  /** One specimen message inside the counted class, never the counted unit. */
  errorFirstLine: string
  count: number
  totalCount: number
}

export type PendingDecision = {
  id: string
  summary: string
  blocker: string
}

export type SessionEndReview = {
  /** Exact claimed batch; acknowledge only after the report is displayed. */
  lifecycleEvents: SkillLifecycleEvent[]
  items: AgendaItem[]
  agenda: string
  /** Candidate FID-routing notes (line-bounded). */
  routing: string[]
  /** FID-2026-1003-007: open register items blocked on an operator ruling. */
  decisions: PendingDecision[]
  /** FID-2026-0912-003: pages created this run (updates are not counted). */
  wikiPages: number
  /**
   * FID-2026-0912-004: mechanical one-proposal cap — false when this session
   * already recorded a proposal. The Orchestrator must NOT spawn the
   * scribe-proposer when this is false (enforced here, not by prompt
   * discipline).
   */
  proposerEligible: boolean
}

/**
 * FID-2026-1003-007 — pending operator decisions, parsed from SCOPE.md.
 *
 * The 2026-10-03 failure this closes: register items sat `**Blocker:**
 * operator ruling` for weeks because nothing PRESENTED them — the operator
 * found the backlog by hand and ruled on all of it in one sitting. The
 * register's own convention (`- [ ] **ID. title** … **Blocker:** …`) is
 * parsed here so the session-end review surfaces every pending decision in
 * the agenda (boot-read at next-session intake) and the routing notes.
 */
export function pendingOperatorDecisions(scope: string): PendingDecision[] {
  const decisions: PendingDecision[] = []
  const lines = scope.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    // The id ends at the first `.` (T94.) — or at an opening paren for
    // compound ids (`T62-followups (remaining …).**`).
    const open = lines[index]!.match(
      /^- \[ \] \*\*([A-Za-z0-9][A-Za-z0-9-]*)(?:\.|\s\()/,
    )
    if (!open) continue
    let block = lines[index]!
    let cursor = index + 1
    // A blocker is DECLARED by a line-leading `**Blocker:**` on the item's own
    // continuation line — that is the register's convention. A mid-sentence
    // `**Blocker:**` belongs to an item that *documents* the convention (this
    // register's own FID-2026-1003-007 entry quotes it inside backticks), not
    // to one blocked on a ruling. Matching the quotation surfaces the item that
    // describes the mechanism as a decision the operator owes, with the quoted
    // sentence as its blocker — noise that erodes the signal the mechanism
    // exists to create. Anchor on the declaration and capture from there, so an
    // item that quotes first and declares later still reads its own blocker.
    let blockerStart = -1
    while (
      cursor < lines.length &&
      !/^(#{2,3} |- \[ \])/.test(lines[cursor]!)
    ) {
      if (blockerStart < 0 && /^\s*\*\*Blocker:\*\*/.test(lines[cursor]!)) {
        blockerStart = block.length
      }
      block += ' ' + lines[cursor]!.trim()
      cursor += 1
    }
    if (blockerStart < 0) continue
    const blocker = block.slice(blockerStart).match(/\*\*Blocker:\*\*([^*]*)/)
    if (!blocker) continue
    decisions.push({
      id: open[1]!.trim(),
      summary: block.slice(open[0].length, open[0].length + 160).trim(),
      blocker: blocker[1]!.trim().slice(0, 140),
    })
  }
  return decisions
}

/**
 * One agenda line clamped to MD013's 120-column budget. A classification
 * cause can be long (`unrecognised-<64 hex>`), so the budget is computed from
 * the prefix instead of assuming a fixed slice — `dev/agenda.md` is committed
 * markdown and `lint:md` runs repository-wide (see AGENDA_MAX_LINE).
 */
function agendaLine(prefix: string, body: string): string {
  const budget = AGENDA_MAX_LINE - prefix.length
  if (budget <= 1) return prefix.slice(0, AGENDA_MAX_LINE)
  return `${prefix}${body.length <= budget ? body : `${body.slice(0, budget - 1)}…`}`
}

/** Build the agenda document from the current recurrences (≤ 50 lines). */
export function buildAgenda(
  recurrences: ReturnType<typeof computeRecurrences>,
  opts: {
    maxItems?: number
    decisions?: PendingDecision[]
    unresolvedClasses?: number
    internalNotes?: string[]
  } = {},
): {
  items: AgendaItem[]
  agenda: string
  routing: string[]
  decisions: PendingDecision[]
} {
  const maxItems = opts.maxItems ?? AGENDA_MAX_ITEMS
  const items: AgendaItem[] = recurrences.slice(0, maxItems).map((r) => ({
    toolName: r.toolName,
    cause: r.cause,
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
  if (opts.unresolvedClasses !== undefined) {
    lines.push(
      `> All-time unresolved classes: ${opts.unresolvedClasses}; age does not prove repair.`,
      '> Full census and ownership: `bun scripts/experiences-recurrence.ts`.',
      '',
    )
  }
  if (items.length === 0) {
    lines.push('_No recurring failure patterns in the last 14 days._', '')
  } else {
    for (const item of items) {
      // A recurrence counts a CLASS, not a message: the ledger groups every
      // exit-127 shell failure under `command-exit`, so printing one specimen
      // beside the class total reads as "this exact message recurred N times".
      // Measured misreading (2026-10-20): `head: command not found` has 5 real
      // rows while the agenda showed 69 — the class total printed beside one
      // specimen. Name the class, mark the specimen. FID-2026-1021-001.
      lines.push(
        agendaLine(
          `- [ ] **${item.toolName}** — ${countedUnitHead({
            cause: item.cause,
            count: item.count,
          })}; e.g. `,
          item.errorFirstLine,
        ),
        agendaLine(
          `      class recurrence (total ${item.totalCount}); count spans the class — `,
          'check ownership and internal follow-ups',
        ),
        '',
      )
    }
  }
  const decisions = opts.decisions ?? []
  lines.push(
    ...internalFollowupAgenda(opts.internalNotes ?? [], AGENDA_MAX_LINE),
  )
  if (decisions.length > 0) {
    lines.push('## Pending operator decisions (FID-2026-1003-007)', '')
    for (const decision of decisions.slice(0, 8)) {
      // MD013 caps the agenda at 120 columns, so each decision's budget is
      // what is left after its own rendered prefix — an id longer than the
      // widest (T62-followups) shortens the summary rather than overflowing.
      const summaryPrefix = `- [ ] **${decision.id}** — `
      const blockerPrefix = '      blocker: '
      lines.push(
        `${summaryPrefix}${decision.summary.slice(0, AGENDA_MAX_LINE - summaryPrefix.length)}`,
        `${blockerPrefix}${decision.blocker.slice(0, AGENDA_MAX_LINE - blockerPrefix.length)}`,
        '',
      )
    }
  }
  const routing: string[] = []
  for (const item of items) {
    routing.push(
      `FID-route: ${item.toolName} · ${countedUnitHead({
        cause: item.cause,
        count: item.count,
      })} in 14d (≥3 bar) — counted across the class; e.g. ${item.errorFirstLine.slice(0, 80)}. ` +
        `Check ownership/internal tracking; new FID only for a demonstrated code defect. ` +
        `Orchestrator direct write when <100 lines (hybrid routing rule).`,
    )
  }
  for (const decision of decisions) {
    routing.push(
      `PRESENT: ${decision.id} — blocker: ${decision.blocker.slice(0, 100)} ` +
        `(SCOPE.md — present at next-session intake; never leave unpresented).`,
    )
  }
  const agenda = lines.slice(0, AGENDA_MAX_LINES).join('\n').trimEnd() + '\n'
  return { items, agenda, routing, decisions }
}

/** Refresh dev/agenda.md from the ledger. Returns the review result. */
export function runSessionEndReview(
  rootDir: string,
  opts: { now?: number; sessionId?: string } = {},
): SessionEndReview {
  const records = readExperienceLedger(rootDir)
  const recurrences = computeRecurrences(records, { now: opts.now })
  let decisions: PendingDecision[] = []
  try {
    decisions = pendingOperatorDecisions(
      fs.readFileSync(path.join(rootDir, 'SCOPE.md'), 'utf8'),
    )
  } catch {
    // No SCOPE.md in this root (tests, foreign repos) — no decisions to surface.
  }
  const classes = summarizeExperienceClasses(records)
  const internalNotes = internalFollowupNotes(rootDir)
  const built = buildAgenda(recurrences, {
    decisions,
    unresolvedClasses: classes.length,
    internalNotes,
  })
  const agendaFile = path.join(rootDir, AGENDA_PATH)
  fs.mkdirSync(path.dirname(agendaFile), { recursive: true })
  fs.writeFileSync(agendaFile, built.agenda, 'utf8')
  // FID-2026-0912-003: distill every promoted pattern (≥3 in 14d — the
  // recurrence engine's own bar; consumed, not re-derived) into the durable
  // pattern wiki. Update-only; never boot-read; the operator's knowledge
  // base and (future FID) the isolated proposer's source material.
  let wikiPages = 0
  for (const r of recurrences) {
    if (updateWikiPattern(rootDir, r, { now: opts.now }) === 'created') {
      wikiPages++
    }
  }
  // FID-2026-0910-001 P3: the deterministic net for non-chat draft sources.
  const quarantineNote = quarantineAlertNote(rootDir)
  // FID-2026-1005-003 Step 4: durable lifecycle-event notices in the same
  // report; construction never advances the session-end cursor.
  const lifecycle = skillLifecycleReport(rootDir)
  const routing = [
    ...built.routing,
    ...internalNotes,
    ...classes.map(
      (entry) =>
        `UNRESOLVED: ${entry.key} — ${entry.count} all-time occurrences; last ${entry.lastSeen}. Age cannot establish repair.`,
    ),
    ...featureRoutingNotes(rootDir),
    ...repairDraftRoutingNotes(rootDir, opts.now),
    ...(quarantineNote !== null ? [quarantineNote] : []),
    ...lifecycle.lines,
    ...telemetryReportLines(rootDir, opts),
  ]
  // FID-2026-0912-004: the proposer may draft only once per session — read
  // from the proposal store, not from conversation memory.
  const proposerEligible =
    opts.sessionId === undefined ||
    proposalsForSession(rootDir, opts.sessionId).length === 0
  return {
    lifecycleEvents: lifecycle.events,
    items: built.items,
    agenda: built.agenda,
    routing,
    decisions: built.decisions,
    wikiPages,
    proposerEligible,
  }
}

if (import.meta.main) {
  const rootDir = path.resolve(import.meta.dir, '..')
  printSessionEndReview(rootDir, runSessionEndReview(rootDir))
  // FID-2026-1016-013 E: the orphan sweep recurs here rather than relying on
  // someone remembering it. Deliberately OUTSIDE runSessionEndReview: the
  // sweep walks the repository, and the review function is called once per
  // test against temp roots where such a walk would be both wrong and slow.
  // Advisory by construction — it prints a count and never sets an exit code.
  const orphans = orphanSweepLine()
  if (orphans !== null) {
    fs.writeSync(process.stdout.fd, `- ${orphans}\n`)
  }
  // FID-2026-1019-001: keep the session audit trail navigable by grouping each
  // summary into its `YYYY-MM/` bucket. Deliberately OUTSIDE
  // runSessionEndReview for the same reason as the sweep — tests call the
  // review against temp roots with no summaries tree. Fail-open: organization
  // must never break the review, and a failed rename is retried next session.
  try {
    const organized = organizeSessionSummaries(
      path.join(rootDir, 'dev', 'session-summaries'),
    )
    const line = sessionSummaryOrganizationLine(organized)
    if (line !== null) {
      fs.writeSync(process.stdout.fd, `- ${line}\n`)
    }
  } catch {
    // Leave the directory untouched; the next SessionEnd retries.
  }
}

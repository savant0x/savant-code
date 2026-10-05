#!/usr/bin/env bun
/**
 * FID-2026-0824-012 S3-B — auto-parse lessons → skills (draft pipeline).
 *
 * Extraction criteria (enforced in `findCandidates`, tested in
 * `__tests__/lessons-to-skills.test.ts`): cross-session recurrence ≥ 3 in
 * the 14-day window (FID-2026-1005-003: DISTINCT sessions), a matching
 * active canonical rule from dev/LEARNINGS.md, a non-trivial guard, and
 * 2+ evidence paths. Drafts go through the SAME quarantine engine as the
 * `skill_manage` tool and land in `.agents/skills/.quarantine/` — never
 * loadable until an operator runs `skills trust`. Rejected drafts archive
 * move-only after 30 days (FID-2026-0912-002). Nothing auto-promotes.
 *
 * CLI: `bun run lessons:to-skills [--archive]`
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import { emitSkillMutationEvent } from '@savant-code/common/util/skill-lifecycle-events'
import { createSkill } from '@savant-code/common/util/skill-management'
// FID-2026-1005-003 Steps 2–4: the mechanical script identifies candidates
// and hands each one to the isolated proposer (prepareCandidateHandoff in
// common) — it no longer authors draft bodies itself. Draft creation goes
// through the shared quarantine engine with the candidate's real content,
// and the mutation-boundary lifecycle event keeps the operator-visible
// traffic-light path identical for background creations.
import { prepareCandidateHandoff } from '@savant-code/common/util/skill-proposals'

import {
  archiveRejectedDrafts,
  DRAFT_REJECTION_WINDOW_DAYS,
} from './draft-archive.js'
import {
  computeRecurrences,
  DEFAULT_MIN_SESSIONS,
  readExperienceLedger,
} from './experiences-dedup.js'

// FID-2026-0912-002: re-export — the CLI/`--archive` surface and its tests
// import from this module; the executor lives in draft-archive.ts.
export { archiveRejectedDrafts, DRAFT_REJECTION_WINDOW_DAYS }

type LessonEntry = {
  title: string
  canonicalRule?: string
  guard: string
  invariant: string
  owningFids: string[]
  evidenceCount: number
  status: string
}

/** Parse LEARNINGS.md into structured entries (line-based field reader). */
export function parseLessons(content: string): LessonEntry[] {
  const entries: LessonEntry[] = []
  const blocks = content.split(/^## Lesson:/m)
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i]
    const title = (block.split('\n', 1)[0] ?? '').trim()
    const fields = new Map<string, string>()
    let current: string | null = null
    for (const line of block.split(/\r?\n/)) {
      const fieldMatch = line.match(/^- \*\*([^*]+):\*\*\s*(.*)$/)
      if (fieldMatch) {
        current = fieldMatch[1]
        fields.set(current, fieldMatch[2])
      } else if (current && line.trim() !== '') {
        // Continuation lines (indented Evidence/Guard blocks) append.
        fields.set(current, `${fields.get(current) ?? ''} ${line.trim()}`)
      }
    }
    const get = (name: string): string => fields.get(name)?.trim() ?? ''
    const owningFids = get('Owning FID')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const evidenceText = get('Evidence')
    // Evidence items are path → kind:target pairs; count distinct items.
    const evidenceCount = evidenceText
      .split(/[,\n]/)
      .filter((s) => s.includes('→')).length
    entries.push({
      title,
      canonicalRule: get('Canonical rule') || undefined,
      guard: get('Guard'),
      invariant: get('Invariant'),
      owningFids,
      evidenceCount: evidenceCount || (evidenceText === '' ? 0 : 1),
      status: get('Status'),
    })
  }
  return entries
}

export function loadLessons(rootDir: string): LessonEntry[] {
  const file = path.join(rootDir, 'dev', 'LEARNINGS.md')
  if (!fs.existsSync(file)) return []
  return parseLessons(fs.readFileSync(file, 'utf8'))
}

export type DraftCandidate = {
  lessonTitle: string
  canonicalRule: string
  toolName: string
  errorFirstLine: string
  count: number
  /** FID-2026-1005-003 Step 1: distinct sessions behind the recurrence. */
  distinctSessions: number
  reasons: string[]
}

/** Apply the S3-B extraction criteria. */
export function findCandidates(
  rootDir: string,
  opts: { now?: number } = {},
): DraftCandidate[] {
  const now = opts.now ?? Date.now()
  const records = readExperienceLedger(rootDir)
  const recurrences = computeRecurrences(records, { now })
  const lessons = loadLessons(rootDir)
  const candidates: DraftCandidate[] = []

  // Significant tokens = words > 4 chars (stopwords and connectors drop out).
  const significantTokens = (value: string): Set<string> =>
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/[\s-]+/)
        .filter((word) => word.length > 4),
    )

  for (const recurrence of recurrences) {
    // FID-2026-1005-003 Step 1: three failures in ONE session are a retry
    // loop, not a reusable-skill signal — a failure-derived candidate
    // requires the pattern across ≥ 3 distinct sessions.
    if (recurrence.distinctSessions < DEFAULT_MIN_SESSIONS) continue
    // Best-effort semantic link: a lesson whose canonical-rule tokens overlap
    // the failure's tokens (the full-fidelity Scribe path does the deep match;
    // this mechanical script only needs a defensible candidate signal).
    const lesson = lessons.find((l) => {
      if (!l.canonicalRule) return false
      const ruleTokens = significantTokens(l.canonicalRule)
      if (ruleTokens.size === 0) return false
      const errorTokens = significantTokens(
        `${recurrence.errorFirstLine} ${l.title}`,
      )
      let overlap = 0
      for (const token of ruleTokens) {
        if (errorTokens.has(token)) overlap++
      }
      return overlap >= 1
    })
    if (!lesson) continue

    const reasons: string[] = []
    if (lesson.status !== 'active') {
      reasons.push(`lesson status is '${lesson.status}' (not active)`)
    }
    // Non-obvious: a guard spanning real synthesis (2+ words).
    if (lesson.guard.split(/\s+/).filter(Boolean).length < 4) {
      reasons.push('guard too thin (likely trivial, not a reusable skill)')
    }
    // Cross-project heuristic: evidence spans 2+ distinct paths.
    if (lesson.evidenceCount < 2) {
      reasons.push('evidence spans fewer than 2 paths (not cross-project)')
    }
    if (reasons.length > 0) {
      candidates.push({
        lessonTitle: lesson.title,
        canonicalRule: lesson.canonicalRule ?? lesson.title,
        toolName: recurrence.toolName,
        errorFirstLine: recurrence.errorFirstLine,
        count: recurrence.count,
        distinctSessions: recurrence.distinctSessions,
        reasons,
      })
      continue
    }
    candidates.push({
      lessonTitle: lesson.title,
      canonicalRule: lesson.canonicalRule ?? lesson.title,
      toolName: recurrence.toolName,
      errorFirstLine: recurrence.errorFirstLine,
      count: recurrence.count,
      distinctSessions: recurrence.distinctSessions,
      reasons: [],
    })
  }
  return candidates
}

/**
 * FID-2026-1005-003 Steps 2–4 — the single proposal path.
 *
 * For each eligible candidate: mechanically reserve the session's ONE
 * proposal slot (`prepareCandidateHandoff` — the record store is the cap,
 * duplicate shas are idempotent resumes, a second distinct proposal fails
 * closed), then create the draft through the shared quarantine engine with
 * the candidate's REAL content — the lesson's canonical rule as the
 * procedure and the trigger/guard contract — replacing the old generic
 * template that never carried the actual lesson. The mutation-boundary
 * event is emitted on success AND on failure (a failed draft must not
 * pretend a draft exists); the event is the durable traffic-light notice.
 */
export function draftCandidates(
  rootDir: string,
  opts: { now?: number; sessionId?: string } = {},
): string[] {
  const drafted: string[] = []
  for (const candidate of findCandidates(rootDir, opts)) {
    if (candidate.reasons.length > 0) continue
    const name = candidate.canonicalRule
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64)
    if (!name || name.length < 3) continue

    // Step 2–3: reserve the proposal slot mechanically BEFORE the write.
    const reserved = prepareCandidateHandoff(
      rootDir,
      {
        skillName: name,
        lessonTitle: candidate.lessonTitle,
        canonicalRule: candidate.canonicalRule,
        toolName: candidate.toolName,
        errorFirstLine: candidate.errorFirstLine,
        count: candidate.count,
        distinctSessions: candidate.distinctSessions,
      },
      { sessionId: opts.sessionId, now: opts.now },
    )
    if (!reserved.ok || reserved.handoff === undefined) continue

    // Step 2: the draft contract — trigger, exact procedure, guard,
    // verification — all from the candidate's evidence-backed fields.
    const result = createSkill({
      rootDir,
      name,
      description:
        candidate.errorFirstLine.slice(0, 60) ||
        `Handles ${candidate.toolName} failure patterns`,
      body: [
        `# ${name.replace(/-/g, ' ')}`,
        '',
        '## When to Use',
        `When ${candidate.toolName} fails with: \`${candidate.errorFirstLine}\`.`,
        '',
        '## Procedure',
        `1. ${candidate.canonicalRule}`,
        '2. Verify with the project test suite before proceeding.',
        '',
        '## Pitfalls',
        '- Do not treat this as a blanket bypass — the rule exists because the naive path fails.',
        '',
        '## Verification',
        '- `bun run typecheck` (all workspaces)',
        '- Focused test suite for the affected area',
        '',
        `> Auto-drafted from lesson: ${candidate.lessonTitle} (${candidate.count}× across ${candidate.distinctSessions} distinct sessions)`,
        '',
      ].join('\n'),
      sessionId: reserved.handoff.record.sessionId,
      reason: `S3-B proposal ${reserved.handoff.proposalSha.slice(0, 12)} from recurrence (${candidate.count}× / ${candidate.distinctSessions} sessions) + canonical rule ${candidate.canonicalRule}`,
      provenanceRef: `lesson:${candidate.canonicalRule} proposal:${reserved.handoff.proposalSha}`,
    })

    // Step 4: the mutation-boundary lifecycle event — success and failure
    // both surface, metadata-only, in the durable traffic-light log.
    emitSkillMutationEvent(rootDir, {
      skillName: name,
      action: result.ok ? 'draft_created' : 'draft_failed',
      sessionId: reserved.handoff.record.sessionId,
      now: opts.now,
    })
    if (result.ok) drafted.push(name)
  }
  return drafted
}

if (import.meta.main) {
  const rootDir = path.resolve(import.meta.dir, '..')
  const candidates = findCandidates(rootDir)
  const eligible = candidates.filter((c) => c.reasons.length === 0)
  const blocked = candidates.filter((c) => c.reasons.length > 0)
  const drafted = draftCandidates(rootDir)
  console.log(
    `lessons:to-skills: ${candidates.length} candidate(s), ${eligible.length} eligible, ${blocked.length} below bar`,
  )
  for (const name of drafted) console.log(`- drafted quarantine skill: ${name}`)
  if (process.argv.includes('--archive')) {
    const archived = archiveRejectedDrafts(rootDir)
    console.log(
      `lessons:to-skills: archived ${archived.length} expired draft(s) >${DRAFT_REJECTION_WINDOW_DAYS}d (move-only, no deletion)`,
    )
  }
}

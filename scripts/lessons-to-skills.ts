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

import { AGENT_AUTHORED_DESCRIPTION_MAX_LENGTH } from '@savant-code/common/constants/skills'
import {
  COUNT_SCOPE_RULE_AGGREGATE,
  countedUnitHead,
  experienceClassIdentity,
} from '@savant-code/common/util/experience-classes'
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
  groupByDedupKey,
  readExperienceLedger,
} from './experiences-dedup.js'
import { readLessonLocator, resolveLesson } from './learnings-locator.js'
import { readCanonicalRuleCatalog } from './learnings-rules.js'

import type { LessonEntry } from './learnings-locator.js'

// FID-2026-0912-002: re-export — the CLI/`--archive` surface and its tests
// import from this module; the executor lives in draft-archive.ts.
export { archiveRejectedDrafts, DRAFT_REJECTION_WINDOW_DAYS }

export { parseLessons } from './learnings-locator.js'

export function loadLessons(rootDir: string): LessonEntry[] {
  const locator = readLessonLocator(rootDir)
  const lessons: LessonEntry[] = []
  for (const title of locator.keys()) {
    const result = resolveLesson(locator, title)
    if (!result.ok) throw new Error(result.issue)
    if (result.replacements.length) continue
    const live = result.locations.find((location) => !location.retired)
    if (live) lessons.push(live.entry)
  }
  return lessons
}

export type DraftCandidate = {
  lessonTitle: string
  canonicalRule: string
  /**
   * FID-2026-1016-015: the lesson's operative rule text. The draft used to
   * carry no lesson content at all — its description was the tool error's
   * first line and its single procedure step was the canonical-rule slug —
   * so the quarantined skill taught the failure message instead of the rule.
   */
  invariant: string
  guard: string
  /** The failure class the candidate's recurrence belongs to. */
  classKey: string
  toolName: string
  errorFirstLine: string
  /**
   * The classification class the count belongs to. `count` is a RULE-level
   * total (it aggregates the recurrences of every class the rule matched),
   * and `errorFirstLine` is one exemplar — so the class is carried alongside
   * them and every rendering states which unit the number counts.
   * FID-2026-1021-001.
   */
  cause: string
  count: number
  /** FID-2026-1005-003 Step 1: distinct sessions behind the recurrence. */
  distinctSessions: number
  reasons: string[]
}

/**
 * FID-2026-1016-015 — one candidate per lesson rule.
 *
 * Iterating recurrences directly emitted one candidate per recurrence ROW, so
 * a single lesson reached the draft path as six proposals with fragmented
 * counts (48×, 27×, 25×, 21×, 14×, 11×) and six different payload hashes —
 * which is also why the store's declared one-proposal-per-session contract
 * was never exercised: every row hashed differently, so nothing looked like a
 * second proposal. Counts now aggregate onto the rule (the skill), the
 * trigger is the highest-count row, and `distinctSessions` stays the
 * strongest single row's figure: two rows can share sessions, so summing them
 * would inflate the promotion gate's own number.
 */
function aggregateByRule(candidates: DraftCandidate[]): DraftCandidate[] {
  const byRule = new Map<string, DraftCandidate>()
  const bestCount = new Map<string, number>()
  for (const candidate of candidates) {
    const existing = byRule.get(candidate.canonicalRule)
    if (existing === undefined) {
      byRule.set(candidate.canonicalRule, { ...candidate })
      bestCount.set(candidate.canonicalRule, candidate.count)
      continue
    }
    existing.count += candidate.count
    existing.distinctSessions = Math.max(
      existing.distinctSessions,
      candidate.distinctSessions,
    )
    if (candidate.count > (bestCount.get(candidate.canonicalRule) ?? 0)) {
      bestCount.set(candidate.canonicalRule, candidate.count)
      existing.toolName = candidate.toolName
      existing.errorFirstLine = candidate.errorFirstLine
      existing.classKey = candidate.classKey
      existing.cause = candidate.cause
    }
  }
  return [...byRule.values()]
}

/**
 * The agent-authored description cap is 60 characters (skills-check
 * `description-length`), which is why the old code sliced the error line at
 * 60 — cutting a real draft mid-word ("retry the tool cal"). Clip at a WORD
 * boundary instead, and describe the rule rather than the failure text.
 */
export function draftDescription(
  lessonTitle: string,
  canonicalRule: string,
): string {
  const clip = (text: string): string => {
    let out = ''
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const next = out === '' ? word : `${out} ${word}`
      if (next.length > AGENT_AUTHORED_DESCRIPTION_MAX_LENGTH) break
      out = next
    }
    return out === ''
      ? text.slice(0, AGENT_AUTHORED_DESCRIPTION_MAX_LENGTH)
      : out
  }
  const fromRule = clip(canonicalRule.replace(/[^a-z0-9]+/gi, ' ').trim())
  if (fromRule !== '') return fromRule
  return clip(lessonTitle)
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
  const catalog = readCanonicalRuleCatalog(rootDir)
  if (catalog.issues.length) return []
  const classKeyByDigest = new Map<string, string>()
  for (const group of groupByDedupKey(records).values()) {
    const sample = group.records[0]
    if (sample)
      classKeyByDigest.set(group.key, experienceClassIdentity(sample).key)
  }
  const rulesByClass = new Map<string, Set<string>>()
  for (const rule of catalog.rules)
    if (rule.tier !== 'historical')
      for (const classKey of rule.failureClasses) {
        const rules = rulesByClass.get(classKey) ?? new Set<string>()
        rules.add(rule.name)
        rulesByClass.set(classKey, rules)
      }
  const matched: DraftCandidate[] = []

  for (const recurrence of recurrences) {
    // Require recurrence across distinct sessions, not an in-session retry loop.
    if (recurrence.distinctSessions < DEFAULT_MIN_SESSIONS) continue
    const classKey = classKeyByDigest.get(recurrence.key)
    const linkedRules = classKey ? rulesByClass.get(classKey) : undefined
    const lesson =
      linkedRules?.size === 1
        ? lessons.find(
            (entry) =>
              entry.status === 'active' &&
              entry.canonicalRule !== undefined &&
              linkedRules.has(entry.canonicalRule),
          )
        : undefined
    if (!lesson) continue
    matched.push({
      lessonTitle: lesson.title,
      canonicalRule: lesson.canonicalRule ?? lesson.title,
      invariant: lesson.invariant,
      guard: lesson.guard,
      classKey: classKey ?? '',
      toolName: recurrence.toolName,
      errorFirstLine: recurrence.errorFirstLine,
      cause: recurrence.cause,
      count: recurrence.count,
      distinctSessions: recurrence.distinctSessions,
      reasons: [],
    })
  }

  const candidates: DraftCandidate[] = []
  for (const candidate of aggregateByRule(matched)) {
    const lesson = lessons.find(
      (entry) =>
        (entry.canonicalRule ?? entry.title) === candidate.canonicalRule,
    )
    if (lesson === undefined) continue
    const reasons: string[] = []
    // Non-obvious: a guard spanning real synthesis (2+ words).
    if (lesson.guard.split(/\s+/).filter(Boolean).length < 4) {
      reasons.push('guard too thin (likely trivial, not a reusable skill)')
    }
    if (lesson.evidenceCount < 2) {
      reasons.push('evidence spans fewer than 2 paths (not cross-project)')
    }
    candidates.push({ ...candidate, reasons })
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
  const quarantineRoot = path.join(rootDir, '.agents/skills/.quarantine')
  for (const candidate of findCandidates(rootDir, opts)) {
    if (candidate.reasons.length > 0) continue
    const name = candidate.canonicalRule
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64)
    if (!name || name.length < 3) continue
    if (fs.existsSync(path.join(quarantineRoot, name, 'SKILL.md'))) continue

    // Step 2–3: reserve the proposal slot mechanically BEFORE the write.
    const reserved = prepareCandidateHandoff(
      rootDir,
      {
        skillName: name,
        lessonTitle: candidate.lessonTitle,
        canonicalRule: candidate.canonicalRule,
        toolName: candidate.toolName,
        errorFirstLine: candidate.errorFirstLine,
        cause: candidate.cause,
        invariant: candidate.invariant,
        guard: candidate.guard,
        count: candidate.count,
        distinctSessions: candidate.distinctSessions,
      },
      { sessionId: opts.sessionId, now: opts.now },
    )
    if (!reserved.ok || reserved.handoff === undefined) continue

    // Step 2: the draft contract — trigger, exact procedure, guard,
    // verification — all from the candidate's evidence-backed fields. The
    // procedure is the lesson's OWN invariant and guard (FID-2026-1016-015),
    // not a restatement of the error the recurrence recorded.
    const result = createSkill({
      rootDir,
      name,
      description: draftDescription(
        candidate.lessonTitle,
        candidate.canonicalRule,
      ),
      body: [
        `# ${candidate.lessonTitle}`,
        '',
        '## When to Use',
        `When \`${candidate.toolName}\` fails with: \`${candidate.errorFirstLine}\`.`,
        '',
        '## Procedure',
        `1. ${candidate.invariant}`,
        `2. ${candidate.guard}`,
        '3. Re-run the focused suite for the affected area before proceeding.',
        '',
        '## Pitfalls',
        '- Do not treat this as a blanket bypass — the rule exists because the naive path fails.',
        `- Ignoring the guard above: the promotion gate recorded this failure ${countedUnitHead(
          {
            cause: candidate.cause,
            count: candidate.count,
            scope: COUNT_SCOPE_RULE_AGGREGATE,
          },
        )} / ${candidate.distinctSessions} distinct sessions.`,
        '',
        '## Verification',
        '- `bun run typecheck` (all workspaces)',
        '- Focused test suite for the affected area',
        '',
        `> Auto-drafted from lesson: ${candidate.lessonTitle} (${countedUnitHead(
          {
            cause: candidate.cause,
            count: candidate.count,
            scope: COUNT_SCOPE_RULE_AGGREGATE,
          },
        )} / ${candidate.distinctSessions} distinct sessions)`,
        '',
      ].join('\n'),
      sessionId: reserved.handoff.record.sessionId,
      reason: `S3-B proposal ${reserved.handoff.proposalSha.slice(0, 12)} from recurrence (${countedUnitHead(
        {
          cause: candidate.cause,
          count: candidate.count,
          scope: COUNT_SCOPE_RULE_AGGREGATE,
        },
      )} / ${candidate.distinctSessions} sessions) + canonical rule ${candidate.canonicalRule}`,
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

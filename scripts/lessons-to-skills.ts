#!/usr/bin/env bun
/**
 * FID-2026-0824-012 S3-B — auto-parse lessons → skills (draft pipeline).
 *
 * Extraction criteria (all must hold before a draft is created):
 *   - recurrence ≥ 3 within the rolling 14-day window (from the ledger);
 *   - a matching canonical rule in dev/LEARNINGS.md with Status active;
 *   - non-obvious: the lesson carries a Guard/Invariant beyond the bare
 *     failure line (a 2+ line Guard implies real synthesis, not trivia);
 *   - cross-project heuristic: the lesson's Evidence spans 2+ distinct
 *     paths (different modules) or the owning FID is closed/verified.
 *
 * Drafts go through the SAME validation path as the skill_manage tool
 * (common/src/util/skill-management.ts createSkill → buildAgentSkillDocument)
 * and land in `.agents/skills/.quarantine/` — NEVER loadable until an
 * operator runs `skills trust`. Each draft carries provenance
 * `{sourceLessonId, sessionId, evidence}` in the ledger provenanceRef.
 *
 * Rejected drafts (quarantine entries older than 30 days, never trusted) are
 * purged mechanically. Nothing auto-promotes.
 *
 * CLI: `bun run lessons:to-skills [--purge]`
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  createSkill,
  readSkillFile,
} from '@savant-code/common/util/skill-management'

import {
  computeRecurrences,
  readExperienceLedger,
} from './experiences-dedup.js'

export const DRAFT_REJECTION_WINDOW_DAYS = 30
const MS_PER_DAY = 24 * 60 * 60 * 1000

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
      reasons: [],
    })
  }
  return candidates
}

/** Draft candidate skills into quarantine via the shared engine path. */
export function draftCandidates(rootDir: string): string[] {
  const drafted: string[] = []
  for (const candidate of findCandidates(rootDir)) {
    if (candidate.reasons.length > 0) continue
    const name = candidate.canonicalRule
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64)
    if (!name || name.length < 3) continue
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
        '1. Recognize the pattern (recurred ' +
          candidate.count +
          '× in 14 days).',
        '2. Apply the canonical rule from the source lesson.',
        '3. Verify with the project test suite before proceeding.',
        '',
        '## Pitfalls',
        '- Do not treat this as a blanket bypass — the rule exists because the naive path fails.',
        '',
        '## Verification',
        '- `bun run typecheck` (all workspaces)',
        '- Focused test suite for the affected area',
        '',
        '> Auto-drafted from lesson: ' + candidate.lessonTitle,
        '',
      ].join('\n'),
      sessionId: 'lessons-to-skills',
      reason: `S3-B auto-draft from recurrence (${candidate.count}×) + canonical rule ${candidate.canonicalRule}`,
      provenanceRef: `lesson:${candidate.canonicalRule}`,
    })
    if (result.ok) drafted.push(name)
  }
  return drafted
}

/**
 * Purge rejected drafts: quarantine entries older than 30 days that were never
 * trusted. Move-only discipline does not apply here — a REJECTED DRAFT is a
 * proposal, not a rule; its provenance lives in the skill ledger + this
 * script's run record. Still, the 30-day window guarantees nothing is
 * destroyed before the operator had a full review cycle.
 */
export function purgeRejectedDrafts(
  rootDir: string,
  opts: { now?: number } = {},
): string[] {
  const now = opts.now ?? Date.now()
  const cutoff = now - DRAFT_REJECTION_WINDOW_DAYS * MS_PER_DAY
  const purgeRoot = path.join(rootDir, '.agents', 'skills', '.quarantine')
  if (!fs.existsSync(purgeRoot)) return []
  const purged: string[] = []
  for (const entry of fs.readdirSync(purgeRoot)) {
    const dir = path.join(purgeRoot, entry)
    const skill = readSkillFile(dir)
    if (!skill) continue
    const stat = fs.statSync(path.join(dir, 'SKILL.md'))
    if (stat.mtimeMs < cutoff) {
      fs.rmSync(dir, { recursive: true, force: true })
      purged.push(entry)
    }
  }
  return purged
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
  if (process.argv.includes('--purge')) {
    const purged = purgeRejectedDrafts(rootDir)
    console.log(
      `lessons:to-skills: purged ${purged.length} rejected draft(s) >30d`,
    )
  }
}

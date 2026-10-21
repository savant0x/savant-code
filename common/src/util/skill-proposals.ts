/**
 * FID-2026-0912-004 — the isolated proposer's record store + prompt builder.
 *
 * The cold-spawned Scribe drafting turn receives ONLY: the wiki index, the
 * relevant pattern pages, the deduped trace rows, and the skill inventory
 * (handoff isolation — WikiSkill §3.2.3 / blueprint §6). No parent
 * conversation history reaches this turn; `includeMessageHistory: false` on
 * the agent definition is the mechanical isolation, this module's prompt
 * builder is the content contract.
 *
 * The proposal store (.savant/skill-proposals.json) is the enforcement point
 * for the one-atomic-proposal-per-session cap: the session-end routing counts
 * records per session id, it does not trust prompt discipline.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  COUNT_SCOPE_RULE_AGGREGATE,
  countedUnitHead,
  formatCountedUnit,
} from './experience-classes'
import { sha256Hex } from './hash'

/** One proposed skill change (atomic: one skill, one action). */
export type SkillProposalRecord = {
  /** sha256 over the canonical proposal payload (dedupe + receipt binding). */
  proposalSha: string
  skillName: string
  action: 'create' | 'patch'
  /** The wiki pattern key that motivated the proposal. */
  patternKey: string
  createdAt: string
  sessionId: string
  rationale: string
}

const STORE_RELATIVE = path.join('.savant', 'skill-proposals.json')

export function proposalStorePath(rootDir: string): string {
  return path.join(rootDir, STORE_RELATIVE)
}

/** Read the whole store (oldest first). Missing store = empty. */
export function readProposalStore(rootDir: string): SkillProposalRecord[] {
  const file = proposalStorePath(rootDir)
  if (!fs.existsSync(file)) return []
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
    return Array.isArray(raw) ? (raw as SkillProposalRecord[]) : []
  } catch {
    return []
  }
}

/** All proposals recorded for one session id (the cap check reads this). */
export function proposalsForSession(
  rootDir: string,
  sessionId: string,
): SkillProposalRecord[] {
  return readProposalStore(rootDir).filter((p) => p.sessionId === sessionId)
}

/** Append one proposal record. Returns ok:false when the sha already exists. */
export function recordProposal(
  rootDir: string,
  record: SkillProposalRecord,
): { ok: boolean; error?: string } {
  if (loadProposalRecord(rootDir, record.proposalSha) !== null) {
    return {
      ok: false,
      error: `proposal ${record.proposalSha} already recorded`,
    }
  }
  const store = readProposalStore(rootDir)
  store.push(record)
  const file = proposalStorePath(rootDir)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(store, null, 2) + '\n', 'utf8')
  return { ok: true }
}

export function loadProposalRecord(
  rootDir: string,
  proposalSha: string,
): SkillProposalRecord | null {
  return (
    readProposalStore(rootDir).find((p) => p.proposalSha === proposalSha) ??
    null
  )
}

export type DraftingPromptInput = {
  /** The wiki index.md content. */
  wikiIndex: string
  /** Relevant pattern pages (full markdown). */
  patternPages: string[]
  /** Deduped trace rows behind the pattern (one line each). */
  dedupedTraces: string[]
  /** Trusted skill inventory (one line each). */
  skillInventory: string[]
}

/**
 * Build the isolated drafting prompt: wiki + traces + inventory ONLY. The
 * prompt never references the parent conversation — the absence is the
 * isolation contract (pinned by test).
 */
export function buildDraftingPrompt(input: DraftingPromptInput): string {
  const lines: string[] = [
    'You are the skill proposer, a cold-spawned Scribe drafting turn.',
    'Your ONLY inputs are below. You have no access to any conversation;',
    'propose from this material alone.',
    '',
    '## Contract',
    '',
    '- Propose AT MOST ONE skill change (create or patch, one skill) —',
    '  the atomic-proposal contract.',
    '- Ground the proposal in the pattern evidence below.',
    '- Emit the proposal via skill_manage (it lands in quarantine).',
    '- If the evidence does not justify a change, propose nothing.',
    '',
    '## Pattern wiki index',
    '',
    input.wikiIndex.trim(),
    '',
    '## Relevant pattern pages',
    '',
    ...input.patternPages.map((page) => page.trim()),
    '',
    '## Deduped failure traces',
    '',
    ...input.dedupedTraces.map((trace) => `- ${trace}`),
    '',
    '## Trusted skill inventory (do not duplicate these)',
    '',
    ...input.skillInventory.map((skill) => `- ${skill}`),
    '',
  ]
  return lines.join('\n')
}

/**
 * FID-2026-1005-003 Steps 2–3 — the mechanical→proposer candidate handoff.
 *
 * The recurrence pipeline (lessons-to-skills) identifies a candidate and
 * calls `prepareCandidateHandoff` instead of writing a generic draft body:
 * this reserves the session's ONE proposal slot mechanically (the record
 * store is the cap, not prompt discipline) and returns everything the
 * isolated Scribe drafting turn needs — the lesson's canonical rule and
 * trigger, the recurrence evidence, and the isolation prompt built by
 * `buildDraftingPrompt`. The slot is taken BEFORE any `skill_manage` write
 * so a concurrent session cannot double-draft.
 */
export type CandidateHandoffInput = {
  /** Skill name derived from the lesson's canonical rule. */
  skillName: string
  /** The lesson title the candidate was extracted from. */
  lessonTitle: string
  /** The lesson's canonical rule — the actual procedure to teach. */
  canonicalRule: string
  /** Tool whose failure triggers the skill. */
  toolName: string
  /** Normalized error first line (the trigger). */
  errorFirstLine: string
  /**
   * The classification class the count belongs to. The trigger message is ONE
   * exemplar inside that class, and the count may span several classes (a
   * rule-level aggregate), so the drafting prompt names the class instead of
   * letting the count read as the message's own tally.
   * FID-2026-1021-001.
   */
  cause: string
  /**
   * FID-2026-1016-015: the lesson's invariant and guard. They are the drafting
   * turn's actual material — without them the proposer saw only the failure
   * text and the rule slug, and produced skills that taught the error message.
   */
  invariant: string
  guard: string
  /** In-window occurrence count. */
  count: number
  /** Distinct sessions behind the count (the promotion gate). */
  distinctSessions: number
}

export type CandidateHandoff = {
  skillName: string
  proposalSha: string
  patternKey: string
  prompt: string
  record: SkillProposalRecord
}

/**
 * Reserve the proposal slot for `sessionId` and build the handoff. A
 * duplicate `proposalSha` is the idempotent-resume case (same proposal,
 * retried after a failed write — returns the handoff again); any OTHER
 * proposal for a session that already has one fails closed with the store's
 * duplicate-slot error.
 */
export function prepareCandidateHandoff(
  rootDir: string,
  candidate: CandidateHandoffInput,
  opts: { sessionId?: string; now?: number } = {},
): { ok: boolean; handoff?: CandidateHandoff; error?: string } {
  const sessionId = opts.sessionId ?? 'lessons-to-skills'
  const payload = JSON.stringify({
    skillName: candidate.skillName,
    lesson: candidate.lessonTitle,
    rule: candidate.canonicalRule,
    tool: candidate.toolName,
    error: candidate.errorFirstLine,
    cause: candidate.cause,
    invariant: candidate.invariant,
    guard: candidate.guard,
    count: candidate.count,
    distinctSessions: candidate.distinctSessions,
  })
  const proposalSha = sha256Hex(payload)
  const record: SkillProposalRecord = {
    proposalSha,
    skillName: candidate.skillName,
    action: 'create',
    patternKey: `lesson:${candidate.canonicalRule}`,
    createdAt: new Date(opts.now ?? Date.now()).toISOString(),
    sessionId,
    rationale: `recurrence ${countedUnitHead({
      cause: candidate.cause,
      count: candidate.count,
      scope: COUNT_SCOPE_RULE_AGGREGATE,
    })} / ${candidate.distinctSessions} distinct sessions + lesson '${candidate.lessonTitle}'`,
  }
  const recorded = recordProposal(rootDir, record)
  if (!recorded.ok) {
    // Idempotent resume of the SAME proposal is allowed; anything else
    // means the session slot is taken — fail closed.
    if (loadProposalRecord(rootDir, proposalSha) === null) {
      return { ok: false, error: recorded.error ?? 'proposal slot taken' }
    }
  }
  const prompt = buildDraftingPrompt({
    wikiIndex: `Candidate: ${candidate.lessonTitle} — rule: ${candidate.canonicalRule} (guard-grade lesson, ${candidate.distinctSessions} distinct sessions)`,
    patternPages: [
      [
        `## ${candidate.lessonTitle}`,
        `Canonical rule: ${candidate.canonicalRule}`,
        `Invariant: ${candidate.invariant}`,
        `Guard: ${candidate.guard}`,
        `Trigger: '${candidate.toolName}' failing with '${candidate.errorFirstLine}'`,
        `Evidence: ${countedUnitHead({
          cause: candidate.cause,
          count: candidate.count,
          scope: COUNT_SCOPE_RULE_AGGREGATE,
        })} / ${candidate.distinctSessions} distinct sessions`,
        'Draft contract: When to Use (this trigger) / Procedure (the invariant, then the guard) / Pitfalls (the guard as a forbidden shortcut) / Verification (the project suite). Never restate the failure text as the rule.',
      ].join('\n'),
    ],
    dedupedTraces: [
      `${candidate.toolName}: ${formatCountedUnit({
        cause: candidate.cause,
        count: candidate.count,
        scope: COUNT_SCOPE_RULE_AGGREGATE,
        exemplar: candidate.errorFirstLine,
      })} / ${candidate.distinctSessions} sessions`,
    ],
    skillInventory: [],
  })
  return {
    ok: true,
    handoff: {
      skillName: candidate.skillName,
      proposalSha,
      patternKey: record.patternKey,
      prompt,
      record,
    },
  }
}

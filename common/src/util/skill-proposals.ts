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

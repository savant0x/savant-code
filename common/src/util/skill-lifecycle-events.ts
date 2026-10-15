/**
 * FID-2026-1005-003 — canonical skill lifecycle events.
 *
 * Every skill-learning transition that the operator must see — proposal
 * presented, draft created/updated, draft failed — emits ONE metadata-only
 * event here. The event log (`.savant/skill-lifecycle-events.jsonl`) is the
 * durable source that survives headless and closed-TUI sessions; the CLI and
 * desktop surfaces consume it with per-surface acknowledgements (see
 * `claimSkillLifecycleEvents` / `acknowledgeSkillLifecycleEvents`).
 *
 * Metadata-only is the safety contract: the schema carries NO free-text
 * fields (no error prose, no model output), so a privileged notice can be
 * built from validated fields alone and can never echo untrusted tool text.
 */

import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'

export const SKILL_LIFECYCLE_EVENTS_RELATIVE = path.join(
  '.savant',
  'skill-lifecycle-events.jsonl',
)

export type SkillLifecycleAction =
  'proposal_presented' | 'draft_created' | 'draft_updated' | 'draft_failed'

export type SkillTrustState =
  'quarantined_pending_trust' | 'trusted' | 'rejected'

export type SkillProofState = 'unproven' | 'proven_on_n_tasks'

export type SkillLifecycleEvent = {
  /** sha256 over the canonical event identity (dedup key + cursor value). */
  id: string
  ts: string
  skillName: string
  action: SkillLifecycleAction
  /** Present for proposal/draft actions; absent when nothing was proposed. */
  proposalSha?: string
  /** sha256 of the draft's SKILL.md bytes, when a draft exists. */
  draftSha?: string
  proofState: SkillProofState
  /** Only meaningful when proofState is 'proven_on_n_tasks'. */
  proofTaskCount?: number
  trustState: SkillTrustState
  sessionId?: string
}

export function skillLifecycleEventsPath(rootDir: string): string {
  return path.join(rootDir, SKILL_LIFECYCLE_EVENTS_RELATIVE)
}

/** Canonical event id: sha256 over the field identity (dedup + cursor). */
export function skillLifecycleEventId(
  event: Omit<SkillLifecycleEvent, 'id'>,
): string {
  const identity = [
    event.ts,
    event.skillName,
    event.action,
    event.proposalSha ?? '',
    event.draftSha ?? '',
    event.trustState,
  ].join('\u0000')
  return createHash('sha256').update(identity, 'utf8').digest('hex')
}

/** Validate the metadata-only contract: no free-text prose fields exist. */
export function isValidSkillLifecycleEvent(
  value: unknown,
): value is SkillLifecycleEvent {
  if (typeof value !== 'object' || value === null) return false
  const e = value as Partial<SkillLifecycleEvent>
  const actions: SkillLifecycleAction[] = [
    'proposal_presented',
    'draft_created',
    'draft_updated',
    'draft_failed',
  ]
  const trustStates: SkillTrustState[] = [
    'quarantined_pending_trust',
    'trusted',
    'rejected',
  ]
  const proofStates: SkillProofState[] = ['unproven', 'proven_on_n_tasks']
  return (
    typeof e.id === 'string' &&
    e.id.length === 64 &&
    typeof e.ts === 'string' &&
    typeof e.skillName === 'string' &&
    e.skillName.length > 0 &&
    actions.includes(e.action as SkillLifecycleAction) &&
    trustStates.includes(e.trustState as SkillTrustState) &&
    proofStates.includes(e.proofState as SkillProofState) &&
    (e.proposalSha === undefined || typeof e.proposalSha === 'string') &&
    (e.draftSha === undefined || typeof e.draftSha === 'string') &&
    (e.proofTaskCount === undefined || typeof e.proofTaskCount === 'number') &&
    (e.sessionId === undefined || typeof e.sessionId === 'string')
  )
}

/**
 * Append one event (fail-open: returns ok:false on any fs error — a
 * visibility failure must be reportable, never silently swallowed as a
 * successful presentation, and must never throw into the caller's flow).
 */
export function appendSkillLifecycleEvent(
  rootDir: string,
  event: Omit<SkillLifecycleEvent, 'id'>,
): { ok: boolean; event?: SkillLifecycleEvent; error?: string } {
  const withId: SkillLifecycleEvent = {
    ...event,
    id: skillLifecycleEventId(event),
  }
  if (!isValidSkillLifecycleEvent(withId)) {
    return { ok: false, error: 'event failed the metadata-only contract' }
  }
  try {
    const file = skillLifecycleEventsPath(rootDir)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.appendFileSync(file, `${JSON.stringify(withId)}\n`, 'utf8')
    return { ok: true, event: withId }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Read the whole event log (oldest first). Missing/corrupt log = empty. */
export function readSkillLifecycleEvents(
  rootDir: string,
): SkillLifecycleEvent[] {
  const file = skillLifecycleEventsPath(rootDir)
  if (!fs.existsSync(file)) return []
  const events: SkillLifecycleEvent[] = []
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (isValidSkillLifecycleEvent(parsed)) events.push(parsed)
    } catch {
      // Malformed line — skip, never fail the read.
    }
  }
  return events
}

/**
 * Per-surface delivery acknowledgement (FID-2026-1005-003).
 *
 * Each surface (CLI, desktop) keeps its own cursor into the shared log so a
 * global pointer can never acknowledge an event on one surface before the
 * other displayed it. The cursor is written ONLY after the surface inserted
 * the notice into its visible transcript — a crash between render and ack
 * replays the event (at-least-once); within a healthy session a claimed
 * batch is never shown twice because the ack advances the cursor.
 */
export type SkillSurfaceId = 'cli' | 'desktop' | 'session-end'

const CURSORS_RELATIVE = path.join('.savant', 'skill-lifecycle-cursors.json')

function cursorsPath(rootDir: string): string {
  return path.join(rootDir, CURSORS_RELATIVE)
}

function readCursors(rootDir: string): Record<string, string> {
  const file = cursorsPath(rootDir)
  if (!fs.existsSync(file)) return {}
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
    return typeof raw === 'object' && raw !== null
      ? (raw as Record<string, string>)
      : {}
  } catch {
    return {}
  }
}

/**
 * Claim unread events for a surface: everything strictly after its cursor,
 * oldest first, bounded (default 10 — a bounded startup batch; the returned
 * `remaining` count keeps overflow visible without acknowledging it).
 * Claiming does NOT acknowledge — call `acknowledgeSkillLifecycleEvents`
 * only after the events are inserted into the surface's transcript.
 */
export function claimSkillLifecycleEvents(
  rootDir: string,
  surface: SkillSurfaceId,
  opts: { limit?: number } = {},
): { events: SkillLifecycleEvent[]; remaining: number } {
  const all = readSkillLifecycleEvents(rootDir)
  const cursor = readCursors(rootDir)[surface]
  const startIndex = cursor ? all.findIndex((e) => e.id === cursor) + 1 : 0
  const unread = startIndex > 0 ? all.slice(startIndex) : all
  const limit = opts.limit ?? 10
  return {
    events: unread.slice(0, limit),
    remaining: Math.max(0, unread.length - limit),
  }
}

/** Advance a surface's cursor past the given (already displayed) events. */
export function acknowledgeSkillLifecycleEvents(
  rootDir: string,
  surface: SkillSurfaceId,
  events: SkillLifecycleEvent[],
): void {
  if (events.length === 0) return
  const last = events[events.length - 1]
  if (!last) return
  const cursors = readCursors(rootDir)
  cursors[surface] = last.id
  try {
    const file = cursorsPath(rootDir)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(cursors, null, 2) + '\n', 'utf8')
  } catch {
    // Fail-open: an unwritten cursor replays the batch next session.
  }
}

/**
 * The single operator-facing line for an event, built from VALIDATED
 * metadata fields only — never raw error text or model prose. Names the
 * skill, action, proof state, and trust state, and points at the review
 * surface (`/skills show`).
 */
export function formatSkillLifecycleNoticeLine(
  event: SkillLifecycleEvent,
): string {
  const proof =
    event.proofState === 'proven_on_n_tasks'
      ? `proven on ${event.proofTaskCount ?? 0} task(s)`
      : 'unproven'
  const trust =
    event.trustState === 'quarantined_pending_trust'
      ? 'QUARANTINED — PENDING TRUST'
      : event.trustState === 'trusted'
        ? 'TRUSTED'
        : 'REJECTED'
  const action = event.action.replaceAll('_', ' ')
  return `skill '${event.skillName}' — ${action} · ${proof} · ${trust} · review: /skills show ${event.skillName}`
}

/**
 * FID-2026-1005-003 Step 4 — the mutation-boundary emission helper.
 *
 * Every non-interactive skill mutation (mechanical scripts, session-end
 * paths) records the canonical event HERE, at the mutation, so a headless
 * creation carries the same durable traffic-light event as an interactive
 * `skill_manage` block. Drafts always land quarantined — the trust state is
 * `quarantined_pending_trust` and proof `unproven` — a green write must
 * never read as trust. Returns the formatted operator line so headless
 * callers can log it; the event log stays the source of truth either way.
 */
export function emitSkillMutationEvent(
  rootDir: string,
  params: {
    skillName: string
    action: 'draft_created' | 'draft_updated' | 'draft_failed'
    draftSha?: string
    sessionId?: string
    now?: number
  },
): { ok: boolean; line?: string; error?: string } {
  const result = appendSkillLifecycleEvent(rootDir, {
    ts: new Date(params.now ?? Date.now()).toISOString(),
    skillName: params.skillName,
    action: params.action,
    ...(params.draftSha !== undefined ? { draftSha: params.draftSha } : {}),
    proofState: 'unproven',
    trustState: 'quarantined_pending_trust',
    ...(params.sessionId !== undefined ? { sessionId: params.sessionId } : {}),
  })
  if (!result.ok || result.event === undefined) {
    return { ok: false, error: result.error ?? 'event append failed' }
  }
  return { ok: true, line: formatSkillLifecycleNoticeLine(result.event) }
}

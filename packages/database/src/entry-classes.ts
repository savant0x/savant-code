import crypto from 'crypto'

import { runCommit } from './commit-journal'
import { parseStoredJson, prepare, requireRow } from './sqlite'

/**
 * FID-2026-1006-002 WP11 (T149 #11): session entry classes.
 *
 * - `message` — a plain conversation entry (existing rows; the default).
 * - `custom` — extension state persisted alongside the conversation,
 *   OUTSIDE the LLM context.
 * - `custom_message` — custom content that IS part of the LLM context.
 * - `label` — a named bookmark at a position in the (linear) history.
 * - `model_change` / `thinking_level_change` — audit entries recording a
 *   mid-session change.
 *
 * Tree branching (id/parentId) from the source harness is deliberately NOT
 * adopted — Savant sessions are linear; revisit only if an SDK consumer
 * asks (FID non-adoption record).
 *
 * Split from `history.ts` for the file-size quality gate; `history.ts`
 * re-exports this module, so both import paths keep working.
 */

export interface MessageHistory {
  id: string
  session_id: string
  role: string
  content: unknown
  /** FID-2026-1006-002 WP11 (T149 #11): session entry class. */
  entry_kind: EntryKind
  /** FID-2026-1006-002 WP11 (T149 #11): excluded from LLM context. */
  exclude_from_context: boolean
  created_at: string
}

export type EntryKind =
  | 'message'
  | 'custom'
  | 'custom_message'
  | 'label'
  | 'model_change'
  | 'thinking_level_change'

export interface SessionEntryInput {
  sessionId: string
  role: string
  content: unknown
  entryKind?: EntryKind
  excludeFromContext?: boolean
  /** Stable id: repeated inserts of the same entry dedup (INSERT OR IGNORE). */
  id?: string
}

// FID-2026-1006-002 WP11: single row mapper — mirrors mapSession in
// sessions.ts so both entry surfaces map columns identically.
export function mapMessageHistory(
  row: Record<string, unknown>,
): MessageHistory {
  return {
    ...row,
    content: parseStoredJson(row.content, null),
    entry_kind: (row.entry_kind as EntryKind) ?? 'message',
    exclude_from_context: Boolean(row.exclude_from_context),
  } as MessageHistory
}

function getMessageRow(id: string): MessageHistory | null {
  const stmt = prepare('SELECT * FROM message_history WHERE id = ?')
  const row = stmt.get(id) as Record<string, unknown> | null
  if (row) return mapMessageHistory(row)
  return null
}

/**
 * General entry factory: any entry class, with the context-exclusion bit.
 * Plain `createMessage` calls keep landing as `message` entries via the DB
 * default (zero consumer changes); new entry classes go through here.
 */
export function createEntry(input: SessionEntryInput): MessageHistory {
  const entryId = input.id || crypto.randomUUID()
  runCommit(
    `
    INSERT OR IGNORE INTO message_history
      (id, session_id, role, content, entry_kind, exclude_from_context)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    [
      entryId,
      input.sessionId,
      input.role,
      JSON.stringify(input.content),
      input.entryKind ?? 'message',
      input.excludeFromContext ? 1 : 0,
    ],
  )
  return requireRow(
    getMessageRow(entryId),
    `read back entry ${entryId} after insert`,
  )
}

/** Extension state — persisted with the session, OUTSIDE the LLM context. */
export function createCustomEntry(
  sessionId: string,
  content: unknown,
  id?: string,
): MessageHistory {
  return createEntry({
    sessionId,
    role: 'custom',
    content,
    entryKind: 'custom',
    excludeFromContext: true,
    id,
  })
}

/** Custom content that IS part of the LLM context. */
export function createCustomMessageEntry(
  sessionId: string,
  role: string,
  content: unknown,
  id?: string,
): MessageHistory {
  return createEntry({
    sessionId,
    role,
    content,
    entryKind: 'custom_message',
    excludeFromContext: false,
    id,
  })
}

/** A named bookmark at a position in the linear history. */
export function createLabelEntry(
  sessionId: string,
  label: string,
  id?: string,
): MessageHistory {
  return createEntry({
    sessionId,
    role: 'label',
    content: { label },
    entryKind: 'label',
    excludeFromContext: true,
    id,
  })
}

/** Audit entry: the selected model changed mid-session. */
export function createModelChangeEntry(
  sessionId: string,
  from: string,
  to: string,
  id?: string,
): MessageHistory {
  return createEntry({
    sessionId,
    role: 'model_change',
    content: { from, to },
    entryKind: 'model_change',
    excludeFromContext: true,
    id,
  })
}

/** Audit entry: the thinking level changed mid-session. */
export function createThinkingLevelChangeEntry(
  sessionId: string,
  from: string,
  to: string,
  id?: string,
): MessageHistory {
  return createEntry({
    sessionId,
    role: 'thinking_level_change',
    content: { from, to },
    entryKind: 'thinking_level_change',
    excludeFromContext: true,
    id,
  })
}

/** Flip the context-exclusion bit on an existing entry (raw-output seam). */
export function setEntryExcludeFromContext(
  id: string,
  excludeFromContext: boolean,
): boolean {
  return (
    runCommit(
      `
    UPDATE message_history
    SET exclude_from_context = ?
    WHERE id = ?
  `,
      [excludeFromContext ? 1 : 0, id],
    ) > 0
  )
}

/** All entries of one class, in the canonical ordering. */
export function getEntriesByKind(
  sessionId: string,
  kind: EntryKind,
): MessageHistory[] {
  const stmt = prepare(
    'SELECT * FROM message_history WHERE session_id = ? AND entry_kind = ? ORDER BY created_at ASC, rowid ASC',
  )
  const rows = stmt.all(sessionId, kind) as Record<string, unknown>[]
  return rows.map(mapMessageHistory)
}

/**
 * The entries that belong in the LLM context: every entry whose
 * `exclude_from_context` bit is clear. Extension state, bookmarks, audit
 * entries, and excluded raw-output entries drop out here.
 */
export function getInContextMessages(sessionId: string): MessageHistory[] {
  const stmt = prepare(
    'SELECT * FROM message_history WHERE session_id = ? AND exclude_from_context = 0 ORDER BY created_at ASC, rowid ASC',
  )
  const rows = stmt.all(sessionId) as Record<string, unknown>[]
  return rows.map(mapMessageHistory)
}

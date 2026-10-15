import crypto from 'crypto'

import { runCommit } from './commit-journal'
import { parseStoredJson, prepare, requireRow } from './sqlite'

// Types
export type SessionScopeType = 'project' | 'global'

export interface Session {
  id: string
  chat_id: string
  agent_id: string
  selected_model: string
  scope_type: SessionScopeType
  scope_id: string
  unread: boolean
  pinned: boolean
  session_state: Record<string, unknown>
  status: string
  created_at: string
  updated_at: string
}

/**
 * FID-2026-0815-015: cyclic-safe session-state serialization. The runtime
 * `SessionState` carries ephemeral, non-serializable fields (timer handles,
 * compliance/provenance engine instances) that can form reference cycles and
 * make `JSON.stringify` throw. Omit them (and functions) before persisting so
 * a live state can never fail the DB save.
 */
const EPHEMERAL_SESSION_KEYS = new Set([
  'activity',
  'activityIdleTimer',
  'echoCompliance',
  'provenance',
])

function stringifySessionState(sessionState: Record<string, unknown>): string {
  return JSON.stringify(sessionState, (key: string, value: unknown) =>
    EPHEMERAL_SESSION_KEYS.has(key) || typeof value === 'function'
      ? undefined
      : value,
  )
}

// Session operations
export function createSession(
  chatId: string,
  agentId: string,
  sessionState: Record<string, unknown>,
  selectedModel: string = '',
  scopeType: SessionScopeType = 'project',
  scopeId: string = chatId,
): Session {
  const id = crypto.randomUUID()
  // FID-2026-1006-002 WP2: durable writes flow through the commit seam so
  // their exact order is assertable (docs/durable-race-catalog.md).
  runCommit(
    `
    INSERT INTO sessions (
      id,
      chat_id,
      agent_id,
      session_state,
      selected_model,
      scope_type,
      scope_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    [
      id,
      chatId,
      agentId,
      stringifySessionState(sessionState),
      selectedModel,
      scopeType,
      scopeId,
    ],
  )
  return requireRow(getSession(id), `read back session ${id} after insert`)
}

function mapSession(row: Record<string, unknown>): Session {
  return {
    ...row,
    unread: Boolean(row.unread),
    pinned: Boolean(row.pinned),
    session_state: parseStoredJson(row.session_state, {}),
  } as Session
}

export function getSession(id: string): Session | null {
  const stmt = prepare('SELECT * FROM sessions WHERE id = ?')
  const row = stmt.get(id) as Record<string, unknown> | null
  if (row) return mapSession(row)
  return null
}

export function updateSession(
  id: string,
  sessionState: Record<string, unknown>,
): boolean {
  return (
    runCommit(
      `
    UPDATE sessions 
    SET session_state = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
      [stringifySessionState(sessionState), id],
    ) > 0
  )
}

// FID-2026-0803-002 DB-2: `created_at` is second-granularity, so every
// ordering query gets a deterministic `rowid` tiebreaker — same-second rows
// now return in insertion order instead of an unspecified order.
export function getSessionsByScope(
  scopeType: SessionScopeType,
  scopeId: string,
): Session[] {
  const stmt = prepare(
    'SELECT * FROM sessions WHERE scope_type = ? AND scope_id = ? ORDER BY created_at DESC, rowid DESC',
  )
  const rows = stmt.all(scopeType, scopeId) as Record<string, unknown>[]
  return rows.map(mapSession)
}

export function updateSessionScope(
  sessionId: string,
  scopeType: SessionScopeType,
  scopeId: string,
): boolean {
  return (
    runCommit(
      `
    UPDATE sessions
    SET scope_type = ?, scope_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
      [scopeType, scopeId, sessionId],
    ) > 0
  )
}

export function updateSessionUnread(
  sessionId: string,
  unread: boolean,
): boolean {
  return (
    runCommit(
      `
    UPDATE sessions
    SET unread = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
      [unread ? 1 : 0, sessionId],
    ) > 0
  )
}

export function updateSessionPinned(
  sessionId: string,
  pinned: boolean,
): boolean {
  return (
    runCommit(
      `
    UPDATE sessions
    SET pinned = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
      [pinned ? 1 : 0, sessionId],
    ) > 0
  )
}

export function getSessionsByChatId(chatId: string, limit?: number): Session[] {
  const stmt = prepare(
    'SELECT * FROM sessions WHERE chat_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?',
  )
  const rows = stmt.all(
    chatId,
    limit === undefined ? -1 : Math.max(0, Math.floor(limit)),
  ) as Record<string, unknown>[]
  return rows.map(mapSession)
}

// FID-2026-0803-002 DB-6: UPDATEs report whether a row was actually changed
// so callers can detect silent no-ops on a missing id.
export function updateSessionModel(sessionId: string, model: string): boolean {
  return (
    runCommit(
      `
    UPDATE sessions 
    SET selected_model = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
      [model, sessionId],
    ) > 0
  )
}

// FID-2026-0803-002 DB-3: single read path — `getLatestModel(chatId?)` replaces
// the previous `getLatestModelForChat` duplicate and the ambiguous
// `saveModel(model, chatId?)` dual-write (both removed; the CLI uses
// `updateSessionModel` + `getLatestModel`).
export function getLatestModel(chatId?: string): string {
  const stmt = chatId
    ? prepare(
        'SELECT selected_model FROM sessions WHERE chat_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1',
      )
    : prepare(
        'SELECT selected_model FROM sessions ORDER BY created_at DESC, rowid DESC LIMIT 1',
      )
  const row = chatId
    ? (stmt.get(chatId) as Record<string, unknown> | null)
    : (stmt.get() as Record<string, unknown> | null)
  return (row?.selected_model as string) || ''
}

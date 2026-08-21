import crypto from 'crypto'

import { parseStoredJson, prepare, requireRow } from './sqlite'

// Types
export interface Session {
  id: string
  chat_id: string
  agent_id: string
  selected_model: string
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
): Session {
  const id = crypto.randomUUID()
  const stmt = prepare(`
    INSERT INTO sessions (id, chat_id, agent_id, session_state, selected_model)
    VALUES (?, ?, ?, ?, ?)
  `)
  stmt.run(
    id,
    chatId,
    agentId,
    stringifySessionState(sessionState),
    selectedModel,
  )
  return requireRow(getSession(id), `read back session ${id} after insert`)
}

export function getSession(id: string): Session | null {
  const stmt = prepare('SELECT * FROM sessions WHERE id = ?')
  const row = stmt.get(id) as Record<string, unknown> | null
  if (row) {
    return {
      ...row,
      session_state: parseStoredJson(row.session_state, {}),
    } as Session
  }
  return null
}

export function updateSession(
  id: string,
  sessionState: Record<string, unknown>,
): boolean {
  const stmt = prepare(`
    UPDATE sessions 
    SET session_state = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  return stmt.run(stringifySessionState(sessionState), id).changes > 0
}

// FID-2026-0803-002 DB-2: `created_at` is second-granularity, so every
// ordering query gets a deterministic `rowid` tiebreaker — same-second rows
// now return in insertion order instead of an unspecified order.
export function getSessionsByChatId(chatId: string): Session[] {
  const stmt = prepare(
    'SELECT * FROM sessions WHERE chat_id = ? ORDER BY created_at DESC, rowid DESC',
  )
  const rows = stmt.all(chatId) as Record<string, unknown>[]
  return rows.map((row) => ({
    ...row,
    session_state: parseStoredJson(row.session_state, {}),
  })) as Session[]
}

// FID-2026-0803-002 DB-6: UPDATEs report whether a row was actually changed
// so callers can detect silent no-ops on a missing id.
export function updateSessionModel(sessionId: string, model: string): boolean {
  const stmt = prepare(`
    UPDATE sessions 
    SET selected_model = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  return stmt.run(model, sessionId).changes > 0
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

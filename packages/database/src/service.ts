import crypto from 'crypto'

import { getDb } from './index'

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

export interface AgentTemplate {
  id: string
  template: Record<string, unknown>
  version: number
  created_at: string
  updated_at: string
}

export interface FidDocument {
  id: string
  session_id: string
  content: string
  status: string
  perfection_loop_phase: string
  created_at: string
  updated_at: string
}

export interface MessageHistory {
  id: string
  session_id: string
  role: string
  content: unknown
  created_at: string
}

/**
 * Parses a stored JSON string, returning `fallback` for corrupt/missing data
 * instead of throwing (FID-006 DB5).
 */
function parseStoredJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string') return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export interface CostTracking {
  id: string
  session_id: string
  agent_id: string
  credits_used: number
  direct_credits_used: number
  created_at: string
}

// FID-2026-0803-002 DB-5: get-after-create round trips must surface an
// explicit error instead of a confusing TypeError from a `!` assertion.
function requireRow<T>(row: T | null, label: string): T {
  if (row == null) {
    throw new Error(`Failed to ${label}`)
  }
  return row
}

// FID-2026-0803-010 DB-C: bun:sqlite statements are reusable — prepare once
// per SQL string and memoize instead of re-preparing on every call. Lazy (not
// import-time) so the fail-open initDatabase and the ':memory:' test escape
// hatch are unaffected. Statements are prepared via getDb(), which resolves
// bun:sqlite on first actual use.
type SqliteStatement = ReturnType<ReturnType<typeof getDb>['prepare']>

const statementCache = new Map<string, SqliteStatement>()

function prepare(sql: string): SqliteStatement {
  let stmt = statementCache.get(sql)
  if (!stmt) {
    stmt = getDb().prepare(sql)
    statementCache.set(sql, stmt)
  }
  return stmt
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

// Agent Template operations
export function createAgentTemplate(
  template: Record<string, unknown>,
): AgentTemplate {
  const id =
    (typeof template.id === 'string' ? template.id : undefined) ||
    crypto.randomUUID()
  const stmt = prepare(`
    INSERT INTO agent_templates (id, template)
    VALUES (?, ?)
  `)
  stmt.run(id, JSON.stringify(template))
  return requireRow(
    getAgentTemplate(id),
    `read back agent template ${id} after insert`,
  )
}

export function getAgentTemplate(id: string): AgentTemplate | null {
  const stmt = prepare('SELECT * FROM agent_templates WHERE id = ?')
  const row = stmt.get(id) as Record<string, unknown> | null
  if (row) {
    return {
      ...row,
      template: parseStoredJson(row.template, {}),
    } as AgentTemplate
  }
  return null
}

export function updateAgentTemplate(
  id: string,
  template: Record<string, unknown>,
): boolean {
  const stmt = prepare(`
    UPDATE agent_templates 
    SET template = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  return stmt.run(JSON.stringify(template), id).changes > 0
}

// FID Document operations
export function createFidDocument(
  sessionId: string,
  content: string,
  id?: string,
): FidDocument {
  const fidId = id || crypto.randomUUID()
  const stmt = prepare(`
    INSERT INTO fid_documents (id, session_id, content)
    VALUES (?, ?, ?)
  `)
  stmt.run(fidId, sessionId, content)
  return requireRow(
    getFidDocument(fidId),
    `read back FID document ${fidId} after insert`,
  )
}

export function getFidDocument(id: string): FidDocument | null {
  const stmt = prepare('SELECT * FROM fid_documents WHERE id = ?')
  return stmt.get(id) as FidDocument | null
}

export function updateFidDocument(
  id: string,
  content: string,
  status: string,
  perfectionLoopPhase: string,
): boolean {
  const stmt = prepare(`
    UPDATE fid_documents 
    SET content = ?, status = ?, perfection_loop_phase = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  return stmt.run(content, status, perfectionLoopPhase, id).changes > 0
}

// Message History operations
// FID-006 DB1: `id` is optional and defaults to a fresh UUID; callers that
// persist the same message repeatedly pass the message's stable id so the
// INSERT OR IGNORE deduplicates instead of growing the table unboundedly.
export function createMessage(
  sessionId: string,
  role: string,
  content: unknown,
  id?: string,
): MessageHistory {
  const messageId = id || crypto.randomUUID()
  const stmt = prepare(`
    INSERT OR IGNORE INTO message_history (id, session_id, role, content)
    VALUES (?, ?, ?, ?)
  `)
  stmt.run(messageId, sessionId, role, JSON.stringify(content))
  return requireRow(
    getMessage(messageId),
    `read back message ${messageId} after insert`,
  )
}

export function getMessage(id: string): MessageHistory | null {
  const stmt = prepare('SELECT * FROM message_history WHERE id = ?')
  const row = stmt.get(id) as Record<string, unknown> | null
  if (row) {
    return {
      ...row,
      content: parseStoredJson(row.content, null),
    } as MessageHistory
  }
  return null
}

export function getMessagesBySessionId(sessionId: string): MessageHistory[] {
  const stmt = prepare(
    'SELECT * FROM message_history WHERE session_id = ? ORDER BY created_at ASC, rowid ASC',
  )
  const rows = stmt.all(sessionId) as Record<string, unknown>[]
  return rows.map((row) => ({
    ...row,
    content: parseStoredJson(row.content, null),
  })) as MessageHistory[]
}

// Cost Tracking operations
export function createCostRecord(
  sessionId: string,
  agentId: string,
  creditsUsed: number,
  directCreditsUsed: number,
): CostTracking {
  const id = crypto.randomUUID()
  const stmt = prepare(`
    INSERT INTO cost_tracking (id, session_id, agent_id, credits_used, direct_credits_used)
    VALUES (?, ?, ?, ?, ?)
  `)
  stmt.run(id, sessionId, agentId, creditsUsed, directCreditsUsed)
  return requireRow(
    getCostRecord(id),
    `read back cost record ${id} after insert`,
  )
}

function getCostRecord(id: string): CostTracking | null {
  const stmt = prepare('SELECT * FROM cost_tracking WHERE id = ?')
  return stmt.get(id) as CostTracking | null
}

export function getCostsBySessionId(sessionId: string): CostTracking[] {
  const stmt = prepare(
    'SELECT * FROM cost_tracking WHERE session_id = ? ORDER BY created_at ASC, rowid ASC',
  )
  return stmt.all(sessionId) as CostTracking[]
}

export function getTotalCostBySessionId(sessionId: string): {
  total_credits: number
  total_direct_credits: number
} {
  const stmt = prepare(`
    SELECT 
      COALESCE(SUM(credits_used), 0) as total_credits,
      COALESCE(SUM(direct_credits_used), 0) as total_direct_credits
    FROM cost_tracking 
    WHERE session_id = ?
  `)
  return stmt.get(sessionId) as {
    total_credits: number
    total_direct_credits: number
  }
}

import crypto from 'crypto'

import { parseStoredJson, prepare, requireRow } from './sqlite'

export interface MessageHistory {
  id: string
  session_id: string
  role: string
  content: unknown
  created_at: string
}

export interface CostTracking {
  id: string
  session_id: string
  agent_id: string
  credits_used: number
  direct_credits_used: number
  created_at: string
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

import crypto from 'crypto'

import { runCommit } from './commit-journal'
import { mapMessageHistory } from './entry-classes'
import { getDb } from './index'
import { prepare, requireRow } from './sqlite'

import type { MessageHistory } from './entry-classes'

// FID-2026-1006-002 WP11: the session entry classes (their types, factory,
// and queries) live in `entry-classes.ts` (file-size quality gate) and are
// re-exported here — one import path for consumers.
export * from './entry-classes'

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
  runCommit(
    `
    INSERT OR IGNORE INTO message_history (id, session_id, role, content)
    VALUES (?, ?, ?, ?)
  `,
    [messageId, sessionId, role, JSON.stringify(content)],
  )
  return requireRow(
    getMessage(messageId),
    `read back message ${messageId} after insert`,
  )
}

/** Mutable conversation only: audits and other sessions never share ownership. */
export function saveConversationMessages(
  sessionId: string,
  messages: readonly { id: string; role: string; content: string }[],
): void {
  getDb().transaction(() => {
    for (const message of messages) {
      const content = JSON.stringify(message.content)
      const existing = prepare(
        'SELECT session_id, entry_kind, role, content FROM message_history WHERE id = ?',
      ).get(message.id) as {
        session_id: string
        entry_kind: string
        role: string
        content: string
      } | null
      if (
        existing &&
        (existing.session_id !== sessionId || existing.entry_kind !== 'message')
      ) {
        throw new Error(
          'Conversation message identity belongs to another owner',
        )
      }
      if (existing?.role === message.role && existing.content === content)
        continue
      runCommit(
        `INSERT INTO message_history(id,session_id,role,content) VALUES (?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET role=excluded.role, content=excluded.content
        WHERE message_history.session_id=excluded.session_id AND message_history.entry_kind='message'`,
        [message.id, sessionId, message.role, content],
      )
    }
  })()
}

export function getMessage(id: string): MessageHistory | null {
  const stmt = prepare('SELECT * FROM message_history WHERE id = ?')
  const row = stmt.get(id) as Record<string, unknown> | null
  if (row) return mapMessageHistory(row)
  return null
}

export function getMessagesBySessionId(sessionId: string): MessageHistory[] {
  const stmt = prepare(
    'SELECT * FROM message_history WHERE session_id = ? ORDER BY created_at ASC, rowid ASC',
  )
  const rows = stmt.all(sessionId) as Record<string, unknown>[]
  return rows.map(mapMessageHistory)
}

// Cost Tracking operations
export function createCostRecord(
  sessionId: string,
  agentId: string,
  creditsUsed: number,
  directCreditsUsed: number,
): CostTracking {
  const id = crypto.randomUUID()
  runCommit(
    `
    INSERT INTO cost_tracking (id, session_id, agent_id, credits_used, direct_credits_used)
    VALUES (?, ?, ?, ?, ?)
  `,
    [id, sessionId, agentId, creditsUsed, directCreditsUsed],
  )
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

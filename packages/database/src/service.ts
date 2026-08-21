import crypto from 'crypto'

import { parseStoredJson, prepare, requireRow } from './sqlite'

// Re-export the extracted domains so `@savant-code/database/service` keeps its
// full public surface (FID-2026-0819-005 quality ratchet: Loop 118).
export {
  createSession,
  getLatestModel,
  getSession,
  getSessionsByChatId,
  updateSession,
  updateSessionModel,
} from './sessions'
export {
  createCostRecord,
  createMessage,
  getCostsBySessionId,
  getMessage,
  getMessagesBySessionId,
  getTotalCostBySessionId,
} from './history'

export type { Session } from './sessions'
export type { CostTracking, MessageHistory } from './history'

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
